package main

import (
	"bufio"
	"net"
	"regexp"

	"github.com/rs/zerolog/log"
)

type WhitelistEntry struct {
	IP   string
	Port int
}

type AuthenticatedClient struct {
	conn        net.Conn
	serverID    int
	serverInfo  *ServerInfo
	initialized bool
	hidden      bool
}

type ServerInfo struct {
	Group  string
	IP     string
	Name   string
	Port   string
	Hidden bool
}

func handleConnection(conn net.Conn, whitelist []WhitelistEntry) {
	remoteAddr, ok := conn.RemoteAddr().(*net.TCPAddr)
	if !ok {
		log.Warn().Msg("Could not get remote TCPAddr, rejecting")
		_ = conn.Close()
		return
	}
	ip := remoteAddr.IP.String()
	port := remoteAddr.Port

	if !isWhitelistedOrPrivate(ip, port, whitelist) {
		log.Warn().Str("ip", ip).Int("port", port).
			Msg("Connection not whitelisted, closing")
		_ = conn.Close()
		return
	}

	client := &AuthenticatedClient{
		conn:     conn,
		serverID: findSpareServerID(),
	}

	addClient(client)

	log.Info().Str("ip", ip).Int("port", port).
		Msg("New client connection established")

	scanner := bufio.NewScanner(conn)
	for scanner.Scan() {
		line := scanner.Text()
		log.Debug().
			Str("from", ip).
			Int("port", port).
			Str("msg", line).
			Msg("Received line")

		if err := handleLine(client, line); err != nil {
			log.Error().Err(err).Msg("Failed to handle line")
		}
	}

	if err := scanner.Err(); err != nil {
		log.Error().Err(err).Msg("Scanner error on connection read")
	}

	onClientDisconnect(client)
}

func onClientDisconnect(client *AuthenticatedClient) {
	_ = client.conn.Close()
	removeClient(client)

	if client.initialized && !client.hidden && client.serverInfo != nil {
		discMsg := Message{
			Context: "Disconnect",
			Data:    client.serverID,
			Target:  "i",
		}
		broadcastGroup(client, &discMsg)

		log.Info().
			Str("ip", client.serverInfo.IP).
			Str("port", client.serverInfo.Port).
			Msg("Client disconnected")
	} else {
		log.Info().
			Str("addr", client.conn.RemoteAddr().String()).
			Msg("Uninitialized or hidden client disconnected")
	}
}

func isWhitelistedOrPrivate(ip string, port int, whitelist []WhitelistEntry) bool {
	if isPrivateIP(ip) {
		return true
	}
	for _, w := range whitelist {
		if w.IP == ip && w.Port == port {
			return true
		}
	}
	return false
}

// isPrivateIP uses regex checks
var privateIPRegexes = []*regexp.Regexp{
	regexp.MustCompile(`^(::f{4}:)?10\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})$`),
	regexp.MustCompile(`^(::f{4}:)?192\.168\.([0-9]{1,3})\.([0-9]{1,3})$`),
	regexp.MustCompile(`^(::f{4}:)?172\.(1[6-9]|2\d|30|31)\.([0-9]{1,3})\.([0-9]{1,3})$`),
	regexp.MustCompile(`^(::f{4}:)?127\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})$`),
	regexp.MustCompile(`^(::f{4}:)?169\.254\.([0-9]{1,3})\.([0-9]{1,3})$`),
	regexp.MustCompile(`^f[cd][0-9a-f]{2}:`),
	regexp.MustCompile(`^fe80:`),
	regexp.MustCompile(`^::1$`),
	regexp.MustCompile(`^::$`),
}

func isPrivateIP(addr string) bool {
	for _, r := range privateIPRegexes {
		if r.MatchString(addr) {
			return true
		}
	}
	return false
}
