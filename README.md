# Flash Tans - Cloud-Native E-Commerce Platform

A production-ready, scalable e-commerce application deployed on Kubernetes with OpenStack infrastructure, featuring comprehensive monitoring, auto-scaling, and enterprise-grade security.

![Flash Tans Academic Poster](flashtans-academic-poster.png)

## 🚀 Overview

Flash Tans is a cloud-native e-commerce platform built with Node.js and MongoDB, deployed on a Kubernetes cluster provisioned via Terraform on OpenStack. The application demonstrates modern DevOps practices including infrastructure as code, container orchestration, horizontal pod autoscaling, and comprehensive observability.

## ✨ Key Features

- **Product Management**: Full CRUD operations for product catalog
- **Order Processing**: Transaction-safe order processing with MongoDB sessions
- **Customer Management**: Secure customer data handling
- **Auto-Scaling**: Horizontal Pod Autoscaler (HPA) based on CPU/memory metrics
- **Monitoring**: Prometheus metrics collection with Grafana dashboards
- **High Availability**: MongoDB StatefulSet with 3 replicas
- **Persistent Storage**: Kubernetes persistent volumes for data durability
- **Security**: Least-privilege security groups and Kubernetes secrets

## 🏗️ Architecture

```
Client
  ↓
NodePort Service (30081)
  ↓
Flash Tans App (Node.js/Express)
  ↓
MongoDB StatefulSet (3 replicas)
  ↑
Prometheus (metrics scraping)
  ↓
Grafana (visualization)
```

### Infrastructure

- **Cloud Provider**: OpenStack
- **Orchestration**: Kubernetes (1 master + 2 worker nodes)
- **IaC**: Terraform
- **Networking**: Private network (192.168.20.0/24) with floating IPs
- **Security**: Least-privilege security groups with restricted SSH access

## 💻 Technology Stack

**Backend**
- Node.js
- Express.js
- EJS (templating)
- Mongoose (MongoDB ODM)

**Database**
- MongoDB (StatefulSet with 3 replicas)

**DevOps & Infrastructure**
- Kubernetes
- Docker
- Terraform
- OpenStack

**Monitoring & Observability**
- Prometheus
- Grafana
- prom-client

## 📦 Project Structure

```
flashtans-app/
├── config/              # Database configuration
├── models/              # MongoDB models (Product, Customer, Order)
├── views/               # EJS templates
├── public/              # Static assets
├── k8s/                 # Kubernetes manifests
│   ├── app-deployment.yaml
│   ├── mongodb-statefulset.yaml
│   ├── hpa.yaml
│   ├── secrets.yaml
│   ├── pv.yaml
│   └── monitoring/      # Prometheus & Grafana configs
├── main.tf              # Terraform infrastructure
├── Dockerfile           # Container image definition
└── server.js            # Application entry point
```

## 🚀 Getting Started

### Prerequisites

- Kubernetes cluster (or OpenStack access for provisioning)
- Docker
- kubectl
- Terraform (for infrastructure provisioning)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/flashtans-app.git
   cd flashtans-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your MongoDB URI
   ```

4. **Run locally**
   ```bash
   npm start
   ```

### Kubernetes Deployment

1. **Provision infrastructure with Terraform**
   ```bash
   terraform init
   terraform plan
   terraform apply
   ```

2. **Deploy to Kubernetes**
   ```bash
   # Create secrets
   kubectl apply -f k8s/secrets.yaml
   
   # Deploy MongoDB
   kubectl apply -f k8s/pv.yaml
   kubectl apply -f k8s/mongodb-statefulset.yaml
   
   # Deploy application
   kubectl apply -f k8s/app-deployment.yaml
   
   # Configure autoscaling
   kubectl apply -f k8s/hpa.yaml
   
   # Deploy monitoring stack
   kubectl apply -f k8s/monitoring/
   ```

3. **Access the application**
   ```bash
   # Get the NodePort service URL
   kubectl get svc flash-tans-service
   # Access at http://<NODE_IP>:30081
   ```

## 📊 Monitoring

### Prometheus Metrics

The application exposes metrics at `/metrics` endpoint including:
- HTTP request duration
- Request count by route
- System metrics (CPU, memory)

### Grafana Dashboards

Access Grafana dashboards to visualize:
- Application performance metrics
- Resource utilization
- Request latency histograms
- Pod scaling events

## 🔒 Security Features

- **Least-Privilege Security Groups**: Restricted access to essential ports only
- **SSH Access Control**: Limited to admin IP addresses
- **Kubernetes Secrets**: Encrypted storage for sensitive credentials
- **Internal-Only Communication**: Cluster components communicate via internal network
- **Network Policies**: Controlled traffic flow between pods

## 🎯 Performance & Scalability

- **Horizontal Pod Autoscaling**: Automatically scales based on CPU/memory
- **MongoDB Replication**: 3-replica StatefulSet for high availability
- **Resource Limits**: Defined CPU/memory requests and limits
- **Load Distribution**: NodePort service distributes traffic across pods

## 📈 Metrics & Observability

- Custom Prometheus metrics for HTTP requests
- Grafana dashboards for real-time monitoring
- Resource utilization tracking
- Application performance insights

## 🛠️ Development

### Running Tests
```bash
npm test
```

### Building Docker Image
```bash
docker build -t flash-tans-app:latest .
docker push yourusername/flash-tans-app:latest
```

## 📝 API Endpoints

- `GET /` - Home page with product listings
- `GET /admin` - Admin dashboard
- `GET /cart` - Shopping cart
- `GET /api/products` - Get all products
- `POST /api/products` - Create new product
- `DELETE /api/products/:id` - Delete product
- `POST /api/orders` - Create order
- `GET /api/orders` - Get all orders
- `GET /metrics` - Prometheus metrics

## 👥 Team

- **Joseph** - Master Node
- **Bertin** - Worker Node 1
- **Tatenda** - Worker Node 2

## 📄 License

This project is part of a CMU Cloud Computing course assignment.

## 🙏 Acknowledgments

- Carnegie Mellon University
- Cloud Computing Course Instructors
- OpenStack Community

---

**Built with ❤️ for Cloud Computing**
