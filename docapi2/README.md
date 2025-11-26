# Readme-like API Reference (React)

This is a minimal React app that demonstrates a readme.io-style API reference with a "Try It" execution console.

Quick start

1. Open a terminal in the project folder (`c:/Users/gopal/OneDrive/Documents/test0989`).
2. Install dependencies:

```powershell
npm install
```

3. Run the dev server:

```powershell
npm run dev
```

Open http://localhost:5173 in your browser.

Notes
- The app loads `api-spec.json` from the project root; replace this with your own spec or point `server` to your API.
- CORS: For the Try It feature to work against remote APIs you must ensure the remote server allows cross-origin requests from your browser or use a proxy.
- The sample `api-spec.json` points to the public Petstore (`https://petstore3.swagger.io/api/v3`) so you can try calls immediately (subject to CORS).
 - The app will automatically fetch `/api-spec.json` from the dev server root. If you want a local static spec, place your file at `public/api-spec.json` so Vite serves it at `/api-spec.json`.
 - File upload: use the "Load OpenAPI JSON file" chooser in the UI — it accepts both JSON and YAML files (the app uses `js-yaml` to parse YAML).
 - URL load: you can paste a remote JSON or YAML OpenAPI URL into the URL box and click `Load`.
 - CORS: For the Try It feature to work against remote APIs you must ensure the remote server allows cross-origin requests from your browser or use a proxy.
 - The sample `api-spec.json` (Petstore) is included under `public/` so the viewer can load it automatically when running the dev server.

Next steps I can do for you
- Add OpenAPI parser and render full docs from OpenAPI/Swagger
- Add authentication support (API key / OAuth) in the Try It console
- Add request history and curl/code snippets

Tell me which next step you want me to implement.
