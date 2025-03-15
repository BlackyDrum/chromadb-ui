## ChromaDB UI

<p>
  ChromaDB UI is a web application for interacting with the ChromaDB vector database using a user-friendly interface.
</p>

![ui1](https://github.com/user-attachments/assets/242fa52a-7c0c-4f94-9e79-c3630db577f1)

![ui7](https://github.com/user-attachments/assets/7ff34407-40e7-41f9-bec5-56fc1989c4ac)

![ui8](https://github.com/user-attachments/assets/9f4884b9-ad2b-4c87-a2f4-8f16993adb9c)

---

### Getting Started
Follow these steps to run ChromaDB UI locally.

1. Clone the repository
```sh
git clone https://github.com/BlackyDrum/chromadb-ui.git
cd chromadb-ui
```

2. Install dependencies
```sh
npm install
```

3. Start the development server
```sh
VITE_PORT=8090 npm run dev
```

## Using Docker Compose for ChromaDB
This repository includes a `docker-compose.yml` file that simplifies starting a ChromaDB container.

1. Ensure Docker is installed and running on your machine.
2. Start the ChromaDB container using the following command
```sh
docker-compose up -d
```
This will start a ChromaDB instance and expose it on the appropriate port.

## Using Docker

You can also run ChromaDB UI using Docker. The Docker image is built and pushed to the GitHub Container Registry.

### Pull the Docker image

```sh
docker pull ghcr.io/<your-github-username>/chromadb-ui:latest
```

### Run the Docker container

```sh
docker run -e VITE_PORT=8090 -p 8090:80 ghcr.io/<your-github-username>/chromadb-ui:latest
```

Replace `<your-github-username>` with your actual GitHub username.

### Troubleshooting CORS Issues
If you encounter issues such as CORS errors while running the application, you can resolve them by changing the port configuration:

1. **Update the Docker Compose file** <br>
Modify the `CHROMA_SERVER_CORS_ALLOW_ORIGINS` environment variable to include the new port:
```yml
environment:
    - CHROMA_SERVER_CORS_ALLOW_ORIGINS=["http://localhost:8090"]
```

2. **Update the `package.json`** <br>
Change the dev script to specify the new port
```json
"scripts": {
    "dev": "vite --port $VITE_PORT"
}
```

After making these changes, restart both the Docker container and the Vite development server. This should resolve the CORS issue.
