# Senior Software Engineer — Coding Interview

## ServiceBox CLI

**Time: 45 minutes** | **Language: Your choice** | **AI tools: Encouraged**

---

## Getting Started

1. Review the starter repository and the config file
2. Choose your programming language
3. Ask any clarifying questions you have
4. Start building


## What We're Evaluating

| Criteria | What we look for |
|---|---|
| **Problem solving** | How you break down the problem, what questions you ask |
| **Architecture** | Project structure, separation of concerns, extensibility |
| **AI collaboration** | How effectively you use AI tools as part of your workflow |
| **Code quality** | Readability, error handling, edge cases |
| **Working software** | Does it actually run? |

**Tip:** You won't finish everything perfectly in 45 minutes, and that's expected. Focus on making architectural decisions you can defend, and get core functionality working first.

*Good luck!*

---

## Background

Your team manages a platform that runs multiple backend services. Currently, engineers interact with services through a patchwork of scripts. You've been asked to build **ServiceBox** — a unified CLI tool that manages the lifecycle of services defined in a configuration file.


**Repository Structure:**

```
├── service.py               # Service simulator (handles all three services)
├── healthcheck.sh           # Checks if a service is responding
├── servicebox.config.yaml   # configuration file
└── README.md
```

### Service Simulators

The `service.py` script simulates backend services. Each service:
- Accepts `--name` and `--port` arguments
- Writes timestamped logs to stdout
- Responds to HTTP requests on its assigned port
- Has a `/health` endpoint
- Takes 1–3 seconds to become "ready" after starting (varies per service)

Example: `python3 service.py --name auth-service --port 8081`

### Configuration File

```yaml
# servicebox.config.yaml

services:
  auth:
    command: "python3 service.py --name auth-service"
    port: 8081
    dependencies: []

  payment:
    command: "python3 service.py --name payment-service"
    port: 8082
    dependencies:
      - auth

  notification:
    command: "python3 service.py --name notification-service"
    port: 8083
    dependencies:
      - auth
      - payment
```

### Health Check Utility

`healthcheck.sh` accepts a host and port, returns exit code 0 if the service is healthy, 1 otherwise.

Usage:
 ```curl http://localhost:8081/health```

---

## Requirements

Build a CLI tool called `servicebox` that supports the following commands:

### `servicebox start [service_name]`

Starts a service (or all services if no name provided).

- Must read configuration from `servicebox.config.yaml`
- Must pass the correct `--port` to each service
- Must handle the service's dependency chain
- Service processes should run in the background

### `servicebox stop [service_name]`

Stops a running service (or all services if no name provided).

### `servicebox status`

Shows the current state of all configured services.

### `servicebox logs <service_name>`

Displays recent log output for the specified service.

---

## Quick Start

Test that the services work:

```bash
# Start a service manually
python3 service.py --name auth-service --port 8081

# In another terminal, check health
curl http://localhost:8081/health
```

