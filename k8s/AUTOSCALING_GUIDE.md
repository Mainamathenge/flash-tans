# Autoscaling & Load Testing Guide

## Step 1: Install Metrics Server

The Metrics Server is required for HPA to read CPU and memory metrics.

```bash
# Install Metrics Server
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# For clusters with self-signed certificates (like yours), patch the deployment
kubectl patch deployment metrics-server -n kube-system --type='json' -p='[{"op": "add", "path": "/spec/template/spec/containers/0/args/-", "value": "--kubelet-insecure-tls"}]'

# Verify Metrics Server is running
kubectl get deployment metrics-server -n kube-system

# Wait for it to be ready (may take 1-2 minutes)
kubectl wait --for=condition=available --timeout=300s deployment/metrics-server -n kube-system

# Test that metrics are available
kubectl top nodes
kubectl top pods
```

## Step 2: Apply HPA Configuration

```bash
# Apply the HPA manifest
kubectl apply -f k8s/hpa.yaml

# Verify HPA is created
kubectl get hpa

# Watch HPA in real-time (keep this terminal open)
kubectl get hpa flash-tans-hpa -w
```

## Step 3: Generate Load with Apache Bench (ab)

### Install Apache Bench (if not installed)

**On Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install -y apache2-utils
```

**On macOS:**
```bash
brew install apache2
```

### Run Load Test

```bash
# Get your floating IP
FLOATING_IP="192.168.81.18"  # Replace with your actual IP

# Test 1: Moderate load (warm-up)
ab -n 1000 -c 10 http://$FLOATING_IP:30081/

# Test 2: Heavy load to trigger scaling
ab -n 50000 -c 100 http://$FLOATING_IP:30081/

# Test 3: Sustained load (run this for 2-3 minutes)
ab -n 100000 -c 200 -t 180 http://$FLOATING_IP:30081/
```

### Alternative: Use k6 (More Advanced)

```bash
# Install k6
curl https://github.com/grafana/k6/releases/download/v0.47.0/k6-v0.47.0-linux-amd64.tar.gz -L | tar xvz
sudo mv k6-v0.47.0-linux-amd64/k6 /usr/local/bin/

# Create load test script
cat > load-test.js << 'EOF'
import http from 'k6/http';
import { sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },   // Ramp up to 50 users
    { duration: '2m', target: 200 },   // Spike to 200 users
    { duration: '1m', target: 200 },   // Stay at 200 users
    { duration: '30s', target: 0 },    // Ramp down
  ],
};

export default function () {
  http.get('http://192.168.81.18:30081/');
  http.get('http://192.168.81.18:30081/api/products');
  sleep(0.1);
}
EOF

# Run k6 load test
k6 run load-test.js
```

## Step 4: Monitor and Document

### Terminal 1: Watch HPA
```bash
kubectl get hpa flash-tans-hpa -w
```

### Terminal 2: Watch Pods
```bash
kubectl get pods -l app=flash-tans -w
```

### Terminal 3: Watch Resource Usage
```bash
watch -n 2 'kubectl top pods -l app=flash-tans'
```

### Terminal 4: Run Load Test
```bash
ab -n 100000 -c 200 -t 180 http://192.168.81.18:30081/
```

## Step 5: Capture Evidence for Report

### Screenshots to Capture:

1. **Before Load Test:**
   ```bash
   kubectl get hpa
   kubectl get pods -l app=flash-tans
   kubectl top pods -l app=flash-tans
   ```

2. **During Load Test (HPA Scaling):**
   - Screenshot of `kubectl get hpa -w` showing:
     - CPU/Memory percentage increasing
     - REPLICAS count increasing (e.g., 2 → 4 → 6)
   
3. **Pod Scaling:**
   - Screenshot of `kubectl get pods -l app=flash-tans -w` showing new pods being created

4. **Grafana Dashboard:**
   - Open Grafana: `http://192.168.81.18:30030`
   - Screenshot showing:
     - CPU Usage spiking
     - Memory Usage increasing
     - Pod count increasing
     - Request rate spiking

5. **After Cooldown (5-10 minutes after load stops):**
   - Screenshot showing replicas scaling back down

## Expected Behavior

### Initial State:
```
NAME              REFERENCE                   TARGETS   MINPODS   MAXPODS   REPLICAS
flash-tans-hpa    Deployment/flash-tans-app   15%/50%   2         10        2
```

### During Load:
```
NAME              REFERENCE                   TARGETS   MINPODS   MAXPODS   REPLICAS
flash-tans-hpa    Deployment/flash-tans-app   85%/50%   2         10        4
flash-tans-hpa    Deployment/flash-tans-app   92%/50%   2         10        6
flash-tans-hpa    Deployment/flash-tans-app   78%/50%   2         10        8
```

### After Cooldown:
```
NAME              REFERENCE                   TARGETS   MINPODS   MAXPODS   REPLICAS
flash-tans-hpa    Deployment/flash-tans-app   12%/50%   2         10        2
```

## Troubleshooting

### If HPA shows `<unknown>` for targets:
```bash
# Check if Metrics Server is running
kubectl get pods -n kube-system | grep metrics-server

# Check Metrics Server logs
kubectl logs -n kube-system deployment/metrics-server

# Verify metrics are available
kubectl top nodes
kubectl top pods
```

### If pods don't scale:
```bash
# Check HPA events
kubectl describe hpa flash-tans-hpa

# Ensure resource requests are set in deployment
kubectl get deployment flash-tans-app -o yaml | grep -A 5 resources
```

## Load Test Comparison

| Tool | Pros | Cons |
|------|------|------|
| **ab** | Simple, pre-installed on many systems | Basic features |
| **k6** | Advanced scenarios, better reporting | Requires installation |
| **JMeter** | GUI, very powerful | Heavy, complex setup |

For quick testing, use **ab**. For detailed reports, use **k6**.
