<p align="center"><img src="./docs/logo.png" /></p>

# Hikari - The Frontend of Everything

> Still in progress

To ensure the environment is unified, this project has been deployed automatically using Docker Compose. Make sure Docker and Cargo are installed on the machine.

Before the formal deployment, you should create a file named `.env` in the project folder, which stores the configuration information of the database that the server will connect to. The example content is as follows:

```env
MARIADB_ROOT_PASSWORD=root
DB_PASSWORD=root
```

Please make sure that the configuration file has correctly filled in all the keys involved in the above example, and cannot be omitted.

Before starting, please make sure that `cargo-make` is installed:

```bash
cargo install --force cargo-make
```

Then execute the following command in the project directory to build the cluster:

```bash
cargo make build
```

If you need to debug in real time, start the cluster in this way:

```bash
cargo make dev
```

While deploying to the server, there are some differences in the way the cluster starts:

```bash
cargo make -p production -e DB_USERNAME=<username> -e DB_PASSWORD=<password> up
# Or use the .env file to keep the password on the server,
# ensuring that the password itself does not appear in the terminal execution history
cargo make -p production --env-file=<filepath> up
```
