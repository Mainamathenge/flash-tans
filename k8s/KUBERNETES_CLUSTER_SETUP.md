# Kubernetes Cluster Setup Guide
## 3-Node Cluster (1 Master + 2 Workers) on Ubuntu

This guide will help you set up a production-ready Kubernetes cluster on three Ubuntu servers.

## Prerequisites

- 3 Ubuntu servers (20.04 or 22.04 LTS recommended)
- Minimum 2 CPU cores and 2GB RAM per node
- Network connectivity between all nodes
- Root or sudo access on all nodes

### Server Naming Convention
- **Master Node**: `k8s-master` (e.g., 192.168.1.10)
- **Worker Node 1**: `k8s-worker1` (e.g., 192.168.1.11)
- **Worker Node 2**: `k8s-worker2` (e.g., 192.168.1.12)

---

## Part 1: Pre-Installation Steps (ALL NODES)

Run these commands on **all three nodes** (master and both workers).

### 1.1 Update System
```bash
sudo apt update && sudo apt upgrade -y
```

### 1.2 Set Hostnames
On **Master Node**:
```bash
sudo hostnamectl set-hostname k8s-master
```

On **Worker Node 1**:
```bash
sudo hostnamectl set-hostname k8s-worker1
```

On **Worker Node 2**:
```bash
sudo hostnamectl set-hostname k8s-worker2
```

### 1.3 Configure /etc/hosts
Add these entries to `/etc/hosts` on **all nodes**:
```bash
sudo tee -a /etc/hosts <<EOF
192.168.1.10 k8s-master
192.168.1.11 k8s-worker1
192.168.1.12 k8s-worker2
EOF
```
> **Note**: Replace IP addresses with your actual server IPs

### 1.4 Disable Swap
```bash
sudo swapoff -a
sudo sed -i '/ swap / s/^\(.*\)$/#\1/g' /etc/fstab
```

### 1.5 Load Kernel Modules
```bash
cat <<EOF | sudo tee /etc/modules-load.d/k8s.conf
overlay
br_netfilter
EOF

sudo modprobe overlay
sudo modprobe br_netfilter
```

### 1.6 Configure Kernel Parameters
```bash
cat <<EOF | sudo tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables  = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward                 = 1
EOF

sudo sysctl --system
```

### 1.7 Install Container Runtime (containerd)
```bash
# Install dependencies
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common

# Add Docker repository
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install containerd
sudo apt update
sudo apt install -y containerd.io

# Configure containerd
sudo mkdir -p /etc/containerd
containerd config default | sudo tee /etc/containerd/config.toml

# Enable SystemdCgroup
sudo sed -i 's/SystemdCgroup = false/SystemdCgroup = true/g' /etc/containerd/config.toml

# Restart containerd
sudo systemctl restart containerd
sudo systemctl enable containerd
```

### 1.8 Install Kubernetes Components
```bash
# Add Kubernetes repository
curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.28/deb/Release.key | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg

echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.28/deb/ /' | sudo tee /etc/apt/sources.list.d/kubernetes.list

# Install kubelet, kubeadm, and kubectl
sudo apt update
sudo apt install -y kubelet kubeadm kubectl

# Hold packages at current version
sudo apt-mark hold kubelet kubeadm kubectl

# Enable kubelet
sudo systemctl enable kubelet
```

---

## Part 2: Initialize Master Node (MASTER ONLY)

Run these commands **only on the master node**.

### 2.1 Initialize Kubernetes Cluster
```bash
sudo kubeadm init \
  --pod-network-cidr=10.244.0.0/16 \
  --apiserver-advertise-address=192.168.1.10 \
  --control-plane-endpoint=k8s-master
```
> **Note**: Replace `192.168.1.10` with your master node's actual IP

### 2.2 Configure kubectl for Regular User
```bash
mkdir -p $HOME/.kube
sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config
```

### 2.3 Install Pod Network (Flannel)
```bash
kubectl apply -f https://github.com/flannel-io/flannel/releases/latest/download/kube-flannel.yml
```

### 2.4 Verify Master Node
```bash
kubectl get nodes
kubectl get pods -A
```

### 2.5 Generate Join Command
```bash
kubeadm token create --print-join-command
```
> **Important**: Save this command! You'll need it to join worker nodes.

The output will look like:
```
kubeadm join k8s-master:6443 --token abcdef.0123456789abcdef \
    --discovery-token-ca-cert-hash sha256:1234567890abcdef...
```

---

## Part 3: Join Worker Nodes (WORKERS ONLY)

Run the join command from Step 2.5 on **both worker nodes**.

### 3.1 Join Worker Node 1
On **k8s-worker1**, run:
```bash
sudo kubeadm join k8s-master:6443 --token <your-token> \
    --discovery-token-ca-cert-hash sha256:<your-hash>
```

### 3.2 Join Worker Node 2
On **k8s-worker2**, run the same command:
```bash
sudo kubeadm join k8s-master:6443 --token <your-token> \
    --discovery-token-ca-cert-hash sha256:<your-hash>
```

---

## Part 4: Verify Cluster (MASTER)

Run these commands on the **master node** to verify your cluster.

### 4.1 Check All Nodes
```bash
kubectl get nodes
```

Expected output:
```
NAME          STATUS   ROLES           AGE   VERSION
k8s-master    Ready    control-plane   10m   v1.28.x
k8s-worker1   Ready    <none>          5m    v1.28.x
k8s-worker2   Ready    <none>          5m    v1.28.x
```

### 4.2 Check System Pods
```bash
kubectl get pods -A
```

All pods should be in `Running` status.

---

## Part 5: Deploy Flash Tans App

### 5.1 Copy Kubernetes Manifests to Master
From your local machine, copy the k8s directory to the master node:
```bash
scp -r k8s/ user@k8s-master:~/flashtans-app/
```

### 5.2 Deploy MongoDB
On the **master node**:
```bash
cd ~/flashtans-app/k8s
kubectl apply -f pv.yaml
kubectl apply -f mongodb-statefulset.yaml
```

### 5.3 Wait for MongoDB to be Ready
```bash
kubectl get pods -w
```
Wait until all MongoDB pods are `Running`.

### 5.4 Deploy Application
```bash
kubectl apply -f app-deployment.yaml
kubectl apply -f hpa.yaml
```

### 5.5 Deploy Monitoring (Optional)
```bash
kubectl apply -f monitoring/
```

### 5.6 Verify Deployment
```bash
kubectl get pods
kubectl get services
kubectl get nodes -o wide
```

---

## Part 6: Access the Application

### 6.1 Get NodePort
```bash
kubectl get svc flash-tans-service
```

### 6.2 Access via Any Node
You can access the app using any node's IP:
- `http://192.168.1.10:30081` (master)
- `http://192.168.1.11:30081` (worker1)
- `http://192.168.1.12:30081` (worker2)

---

## Troubleshooting

### Issue: Nodes Not Ready
```bash
# Check node status
kubectl describe node <node-name>

# Check kubelet logs
sudo journalctl -u kubelet -f
```

### Issue: Pods Not Starting
```bash
# Check pod details
kubectl describe pod <pod-name>

# Check pod logs
kubectl logs <pod-name>
```

### Issue: Network Issues
```bash
# Verify Flannel is running
kubectl get pods -n kube-flannel

# Check network connectivity
ping k8s-worker1
ping k8s-worker2
```

### Reset a Node (if needed)
```bash
sudo kubeadm reset
sudo rm -rf /etc/cni/net.d
sudo rm -rf $HOME/.kube/config
```

---

## Useful Commands

### View Cluster Info
```bash
kubectl cluster-info
kubectl get nodes -o wide
kubectl get pods -A -o wide
```

### Label Worker Nodes
```bash
kubectl label node k8s-worker1 node-role.kubernetes.io/worker=worker
kubectl label node k8s-worker2 node-role.kubernetes.io/worker=worker
```

### Drain Node for Maintenance
```bash
kubectl drain k8s-worker1 --ignore-daemonsets
kubectl uncordon k8s-worker1
```

### Generate New Join Token (if expired)
```bash
kubeadm token create --print-join-command
```

---

## Security Recommendations

1. **Firewall Configuration**: Open required ports
   - Master: 6443, 2379-2380, 10250-10252
   - Workers: 10250, 30000-32767

2. **SSH Key Authentication**: Use SSH keys instead of passwords

3. **Regular Updates**: Keep Kubernetes and OS updated
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

4. **RBAC**: Implement Role-Based Access Control for users

5. **Network Policies**: Implement network policies for pod-to-pod communication

---

## Next Steps

1. Set up persistent storage with NFS or local storage provisioner
2. Configure ingress controller (nginx-ingress) for better routing
3. Set up backup and disaster recovery
4. Implement monitoring with Prometheus and Grafana
5. Configure log aggregation with ELK stack

---

## References

- [Kubernetes Official Documentation](https://kubernetes.io/docs/)
- [kubeadm Installation Guide](https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/)
- [Flannel Network Plugin](https://github.com/flannel-io/flannel)
