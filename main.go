// main.go
package main

import (
	"context"
	"fmt"
	"net"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync"
	"syscall"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

var (
	clients   = make([]*AuthenticatedClient, 0)
	clientsMu sync.RWMutex
)

func main() {
	output := zerolog.NewConsoleWriter(func(w *zerolog.ConsoleWriter) {
		w.TimeFormat = "15:04:05.000"
	})
	log.Logger = zerolog.New(output).With().Timestamp().Logger()

	host := getEnv("HOST", "0.0.0.0")
	portStr := getEnv("PORT", "27200")
	port, err := strconv.Atoi(portStr)
	if err != nil {
		log.Fatal().Err(err).Msg("Invalid PORT environment variable")
	}

	// Parse WHITELIST environment (e.g. "127.0.0.1:27115,62.226.205.78:27015")
	wlEnv := getEnv("WHITELIST", "")
	whitelist, err := parseWhitelistEnv(wlEnv)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to parse WHITELIST")
	}
	log.Info().Msgf("Loaded %d whitelist entries from environment", len(whitelist))

	addr := fmt.Sprintf("%s:%d", host, port)
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to start TCP server")
	}
	defer listener.Close()

	log.Info().Msgf("Relay server ready at tcp://%s", addr)

	// Listen for Ctrl+C / SIGTERM to shut down gracefully
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go func() {
		for {
			conn, err := listener.Accept()
			if err != nil {
				select {
				case <-ctx.Done():
					return
				default:
					log.Error().Err(err).Msg("Failed to accept connection")
					continue
				}
			}
			go handleConnection(conn, whitelist)
		}
	}()

	<-ctx.Done()
	log.Info().Msg("Shutting down gracefully...")

	_ = listener.Close()

	clientsMu.Lock()
	for _, c := range clients {
		_ = c.conn.Close()
	}
	clients = nil
	clientsMu.Unlock()

	log.Info().Msg("All connections closed. Bye!")
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func parseWhitelistEnv(envVal string) ([]WhitelistEntry, error) {
	if envVal == "" {
		return nil, nil
	}

	var result []WhitelistEntry
	parts := strings.Split(envVal, ",")
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		sub := strings.Split(part, ":")
		if len(sub) != 2 {
			return nil, fmt.Errorf("invalid format (need ip:port): %s", part)
		}
		ip := strings.TrimSpace(sub[0])
		portStr := strings.TrimSpace(sub[1])
		p, err := strconv.Atoi(portStr)
		if err != nil {
			return nil, fmt.Errorf("invalid port: %s", portStr)
		}
		result = append(result, WhitelistEntry{IP: ip, Port: p})
	}
	return result, nil
}
