# LyngoSketch Wiki

LyngoSketch Wiki is a lightweight, multi-instance wiki engine designed for collaborative knowledge management. It utilizes a SQLite database for persistent storage. Ensure that the host environment provides sufficient permissions for read and write operations on the database file at the project root.

## Technical Requirements

- Node.js (v18+)
- SQLite

## Installation

1. Clone the repository.
2. Install dependencies: `npm install`.
3. Compile the project: `npm run build`.

## Operation

To initiate the server, run `npm start`. The application defaults to port 3000. Port modifications must be reflected in the server configuration and any relevant system service definitions.

The server process must be executed within the project root directory. Failure to maintain a consistent working directory will result in the server failing to access the persistent `wiki.sqlite` file, causing data loss upon restart.

## Authentication & Access Control

User authentication is managed through a local `passwd.json` file located in the project root. This file must be maintained manually in the following JSON format:

```json
{
  "users": {
    "username": { "password": "securepassword", "role": "admin|user" }
  }
}
```

The system assigns permissions based on the defined `role`. Access is required to the root directory for modification. Changes to this file take effect upon server restart.

See the Coder.md file.

## Architecture and Maintenance

Data is managed via a SQLite database, ensuring atomicity and efficient querying of page content.

For production environments, utilize robust process management utilities to ensure service continuity. It is recommended to deploy instances behind a reverse proxy to manage traffic and implement mandatory SSL/TLS encryption for public-facing servers.

## Support

Refer to the provided `Coder.md` manual for comprehensive technical guidelines regarding system integration, process management, and maintenance requirements.

## License

MIT
