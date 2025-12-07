# Security Implementation Documentation

## 1. Kubernetes Secrets Implementation

### Overview
All sensitive data has been secured using Kubernetes Secrets instead of hardcoded values in deployment manifests. This follows security best practices by separating configuration from code and enabling encrypted storage of sensitive information.

### Implemented Secrets

#### MongoDB Secret (`mongodb-secret`)
Contains MongoDB connection credentials and configuration:
- `mongodb-uri`: Full MongoDB replica set connection string
- `mongodb-database`: Database name
- `mongodb-replica-set`: Replica set identifier

#### Application Secret (`app-secret`)
Contains application-level secrets:
- `session-secret`: Session encryption key
- `jwt-secret`: JWT token signing key
- `api-key`: External API authentication key

### Deployment Configuration
The application deployment has been updated to reference secrets using `valueFrom.secretKeyRef` instead of hardcoded values:

```yaml
env:
  - name: MONGO_URI
    valueFrom:
      secretKeyRef:
        name: mongodb-secret
        key: mongodb-uri
```

### Creating Secrets in Production

**Option 1: From YAML (Development/Staging)**
```bash
kubectl apply -f k8s/secrets.yaml
```

**Option 2: From Command Line (Production - Recommended)**
```bash
# Create MongoDB secret
kubectl create secret generic mongodb-secret \
  --from-literal=mongodb-uri='mongodb://mongodb-0.mongodb-service:27017,mongodb-1.mongodb-service:27017,mongodb-2.mongodb-service:27017/flash_tans?replicaSet=rs0' \
  --from-literal=mongodb-database='flash_tans' \
  --from-literal=mongodb-replica-set='rs0'

# Create application secret
kubectl create secret generic app-secret \
  --from-literal=session-secret='CHANGE_THIS_IN_PRODUCTION' \
  --from-literal=jwt-secret='CHANGE_THIS_IN_PRODUCTION' \
  --from-literal=api-key='CHANGE_THIS_IN_PRODUCTION'
```

**Option 3: From Files (Most Secure)**
```bash
# Store secrets in files (not committed to git)
echo -n 'mongodb://...' > mongodb-uri.txt
kubectl create secret generic mongodb-secret --from-file=mongodb-uri=mongodb-uri.txt
rm mongodb-uri.txt  # Clean up
```

### Verifying Secrets
```bash
# List secrets
kubectl get secrets

# View secret details (base64 encoded)
kubectl get secret mongodb-secret -o yaml

# Decode secret value
kubectl get secret mongodb-secret -o jsonpath='{.data.mongodb-uri}' | base64 --decode
```

---

## 2. OpenStack Security Groups - Least Privilege Implementation

### Security Group Configuration

#### Inbound Rules (Ingress)

| Rule Name | Protocol | Port Range | Source | Purpose |
|-----------|----------|------------|--------|---------|
| SSH Access | TCP | 22 | Your IP/CIDR | Remote administration |
| HTTP | TCP | 80 | 0.0.0.0/0 | Web traffic |
| HTTPS | TCP | 443 | 0.0.0.0/0 | Secure web traffic |
| Kubernetes API | TCP | 6443 | Cluster CIDR | API server access |
| NodePort Range | TCP | 30000-32767 | Allowed IPs | Application access |
| Flannel VXLAN | UDP | 8472 | Cluster CIDR | Pod networking |
| Kubelet API | TCP | 10250 | Cluster CIDR | Node communication |

#### Outbound Rules (Egress)

| Rule Name | Protocol | Port Range | Destination | Purpose |
|-----------|----------|------------|-------------|---------|
| All Traffic | All | All | 0.0.0.0/0 | Allow outbound |

### OpenStack CLI Commands

```bash
# Create security group
openstack security group create k8s-cluster-sg \
  --description "Kubernetes cluster security group with least privilege"

# SSH access (restrict to your IP)
openstack security group rule create k8s-cluster-sg \
  --protocol tcp \
  --dst-port 22 \
  --remote-ip YOUR_IP_ADDRESS/32

# HTTP/HTTPS (public access)
openstack security group rule create k8s-cluster-sg \
  --protocol tcp \
  --dst-port 80 \
  --remote-ip 0.0.0.0/0

openstack security group rule create k8s-cluster-sg \
  --protocol tcp \
  --dst-port 443 \
  --remote-ip 0.0.0.0/0

# Kubernetes API (cluster internal only)
openstack security group rule create k8s-cluster-sg \
  --protocol tcp \
  --dst-port 6443 \
  --remote-group k8s-cluster-sg

# NodePort range (restrict to known IPs)
openstack security group rule create k8s-cluster-sg \
  --protocol tcp \
  --dst-port 30000:32767 \
  --remote-ip YOUR_NETWORK_CIDR

# Flannel VXLAN (cluster internal)
openstack security group rule create k8s-cluster-sg \
  --protocol udp \
  --dst-port 8472 \
  --remote-group k8s-cluster-sg

# Kubelet API (cluster internal)
openstack security group rule create k8s-cluster-sg \
  --protocol tcp \
  --dst-port 10250 \
  --remote-group k8s-cluster-sg

# Allow all outbound
openstack security group rule create k8s-cluster-sg \
  --protocol any \
  --egress
```

### Least Privilege Principles Applied

1. **SSH Access**: Restricted to specific IP addresses (not 0.0.0.0/0)
2. **Kubernetes API**: Only accessible from within the cluster
3. **NodePort Services**: Limited to known network ranges
4. **Internal Communication**: Cluster components can only communicate with each other
5. **No Unnecessary Ports**: Only required ports are opened
6. **Egress Control**: Outbound traffic allowed (can be further restricted if needed)

### Security Group Assignment

```bash
# Assign to instances
openstack server add security group k8s-master-joseph k8s-cluster-sg
openstack server add security group k8s-worker-1-bertin k8s-cluster-sg
openstack server add security group k8s-worker-2-tatenda k8s-cluster-sg
```

### Verification

```bash
# List security groups
openstack security group list

# Show security group rules
openstack security group show k8s-cluster-sg

# Verify instance security groups
openstack server show k8s-master-joseph -c security_groups
```

---

## Security Best Practices Checklist

- [x] Kubernetes Secrets created for all sensitive data
- [x] Secrets referenced in deployments (not hardcoded)
- [x] OpenStack Security Groups configured with least privilege
- [x] SSH access restricted to known IPs
- [x] Cluster internal communication isolated
- [x] NodePort access limited to authorized networks
- [x] No unnecessary ports exposed
- [ ] Enable Kubernetes RBAC (Role-Based Access Control)
- [ ] Implement Network Policies for pod-to-pod communication
- [ ] Enable audit logging
- [ ] Regular security updates and patches
