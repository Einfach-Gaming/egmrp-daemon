package main

import (
	"encoding/json"
	"fmt"

	"github.com/rs/zerolog/log"
)

// Message is the inbound/outbound JSON structure.
type Message struct {
	Context string      `json:"context"`
	Data    interface{} `json:"data"`
	Sender  *float64    `json:"sender,omitempty"`
	Target  interface{} `json:"target"`
}

// handleLine is called for each newline-delimited JSON message from a client.
func handleLine(client *AuthenticatedClient, line string) error {
	var msg Message
	if err := json.Unmarshal([]byte(line), &msg); err != nil {
		return fmt.Errorf("json decode: %w", err)
	}

	switch t := msg.Target.(type) {
	case string:
		switch t {
		case "i":
			return identifyServer(client, &msg)
		case "b":
			if !client.initialized {
				return fmt.Errorf("sender not initialized, cannot broadcast to all")
			}
			broadcastAll(client, &msg)
		case "g":
			if !client.initialized {
				return fmt.Errorf("sender not initialized, cannot broadcast to group")
			}
			broadcastGroup(client, &msg)
		default:
			log.Error().Str("target", t).Msg("Unknown target string")
		}

	case float64:
		if !client.initialized {
			return fmt.Errorf("sender not initialized, cannot direct-send")
		}
		receiverID := int(t)
		receiver := getClientByID(receiverID)
		if receiver == nil {
			log.Error().Int("receiverID", receiverID).Msg("Unknown receiver")
			return nil
		}
		sendMessageToClient(receiver, &msg)

	default:
		log.Error().Msgf("Unknown target type: %T", t)
	}

	return nil
}

func identifyServer(client *AuthenticatedClient, msg *Message) error {
	dataBytes, err := json.Marshal(msg.Data)
	if err != nil {
		return fmt.Errorf("failed to marshal identify data: %w", err)
	}

	var info ServerInfo
	if err := json.Unmarshal(dataBytes, &info); err != nil {
		return fmt.Errorf("failed to unmarshal identify data: %w", err)
	}

	client.serverInfo = &info
	client.hidden = info.Hidden
	client.initialized = true

	log.Info().
		Str("name", info.Name).
		Str("group", info.Group).
		Bool("hidden", info.Hidden).
		Msgf("%s has joined group %s", info.Name, info.Group)

	identifyConfirmation := Message{
		Context: "Identify",
		Data:    client.serverID,
		Target:  "i",
	}
	sendMessageToClient(client, &identifyConfirmation)

	currentServerMsg := Message{
		Context: "Connect",
		Target:  "i",
	}
	clientsMu.RLock()
	for _, existing := range clients {
		if existing.initialized &&
			existing.serverInfo != nil &&
			existing.serverInfo.Group == info.Group &&
			existing.serverID != client.serverID &&
			!existing.hidden {
			msgData := map[string]interface{}{
				"id":   existing.serverID,
				"ip":   existing.serverInfo.IP,
				"name": existing.serverInfo.Name,
				"port": existing.serverInfo.Port,
			}
			currentServerMsg.Data = msgData
			sendMessageToClient(client, &currentServerMsg)
		}
	}
	clientsMu.RUnlock()

	if !client.hidden {
		welcomeMsg := Message{
			Context: "Connect",
			Data: map[string]interface{}{
				"id":   client.serverID,
				"ip":   info.IP,
				"name": info.Name,
				"port": info.Port,
			},
			Target: "i",
		}
		broadcastGroup(client, &welcomeMsg)
	}

	return nil
}

func broadcastAll(sender *AuthenticatedClient, msg *Message) {
	clientsMu.RLock()
	defer clientsMu.RUnlock()

	for _, c := range clients {
		if c.initialized && c.serverID != sender.serverID {
			sendMessageToClient(c, msg)
		}
	}
}

func broadcastGroup(sender *AuthenticatedClient, msg *Message) {
	if sender.serverInfo == nil {
		return
	}
	group := sender.serverInfo.Group

	clientsMu.RLock()
	defer clientsMu.RUnlock()
	for _, c := range clients {
		if c.initialized && c.serverInfo != nil &&
			c.serverInfo.Group == group &&
			c.serverID != sender.serverID {
			sendMessageToClient(c, msg)
		}
	}
}

func sendMessageToClient(receiver *AuthenticatedClient, msg *Message) {
	data, err := json.Marshal(msg)
	if err != nil {
		log.Error().Err(err).Msg("Failed to marshal message")
		return
	}
	_, err = receiver.conn.Write(append(data, '\n'))
	if err != nil {
		log.Error().Err(err).Msg("Failed to write message to client")
	}
}
