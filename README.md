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
npm run dev
```

## Using Docker Compose for ChromaDB

This repository includes a `docker-compose.yml` file that simplifies starting a ChromaDB container.

1. Ensure Docker is installed and running on your machine.
2. Start the ChromaDB container using the following command

```sh
docker-compose up -d
```

This will start a ChromaDB instance and expose it on the appropriate port.

## Troubleshooting CORS Issues

If you encounter CORS errors while running the application, you'll need to ensure that the Chroma backend allows requests from the correct frontend origin.

### Update the Chroma config file (`config.yaml`)

Modify the `cors_allow_origins` field to match the port your frontend is running on:

```yml
persist_path: "/data"
cors_allow_origins: ["http://localhost:8090"] # Change to your actual frontend port
```

After making these changes, restart both the Docker container and the Vite development server. This should resolve the CORS issue.
