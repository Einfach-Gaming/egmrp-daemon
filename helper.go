package main

func addClient(c *AuthenticatedClient) {
	clientsMu.Lock()
	defer clientsMu.Unlock()
	clients = append(clients, c)
}

func removeClient(c *AuthenticatedClient) {
	clientsMu.Lock()
	defer clientsMu.Unlock()

	for i, cc := range clients {
		if cc == c {
			clients = append(clients[:i], clients[i+1:]...)
			break
		}
	}
}

func getClientByID(id int) *AuthenticatedClient {
	clientsMu.RLock()
	defer clientsMu.RUnlock()

	for _, c := range clients {
		if c.serverID == id {
			return c
		}
	}
	return nil
}

func findSpareServerID() int {
	clientsMu.RLock()
	defer clientsMu.RUnlock()

	id := 1
	for {
		if !containsID(id) {
			return id
		}
		id++
	}
}

func containsID(id int) bool {
	for _, c := range clients {
		if c.serverID == id {
			return true
		}
	}
	return false
}
