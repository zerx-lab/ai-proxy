{
	// The app is not currently linked to the encore.dev platform.
	// Use "encore app link" to link it.
	"id":   "",
	"lang": "typescript",
	"global_cors": {
		// Frontend (https://ai.zerx.dev) is the only origin allowed to call the
		// backend (https://ai-api.zerx.dev). Bearer-token requests are non-credentialed
		// (no cookies), so they match allow_origins_without_credentials; the credentialed
		// list is kept in sync in case cookie-based auth is added later.
		"allow_origins_without_credentials": [
			"https://ai.zerx.dev"
		],
		"allow_origins_with_credentials": [
			"https://ai.zerx.dev"
		]
	}
}
