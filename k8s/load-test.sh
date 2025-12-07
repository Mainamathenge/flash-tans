#!/bin/bash

# Flash Tans Load Testing Script
# This script generates load to trigger HPA autoscaling

set -e

# Configuration
FLOATING_IP="${FLOATING_IP:-192.168.81.18}"
NODE_PORT="30081"
BASE_URL="http://${FLOATING_IP}:${NODE_PORT}"

echo "========================================="
echo "Flash Tans Load Testing Script"
echo "========================================="
echo "Target: $BASE_URL"
echo ""

# Check if ab is installed
if ! command -v ab &> /dev/null; then
    echo "Error: Apache Bench (ab) is not installed"
    echo "Install with: sudo apt-get install apache2-utils"
    exit 1
fi

# Function to check HPA status
check_hpa() {
    echo ""
    echo "Current HPA Status:"
    kubectl get hpa flash-tans-hpa 2>/dev/null || echo "HPA not found. Apply with: kubectl apply -f k8s/hpa.yaml"
    echo ""
}

# Function to check pod count
check_pods() {
    echo "Current Pod Count:"
    kubectl get pods -l app=flash-tans --no-headers | wc -l
    echo ""
}

# Test connectivity
echo "Testing connectivity..."
if curl -s -o /dev/null -w "%{http_code}" "$BASE_URL" | grep -q "200"; then
    echo "✓ Application is reachable"
else
    echo "✗ Application is not reachable at $BASE_URL"
    echo "Please check your FLOATING_IP and NODE_PORT"
    exit 1
fi

echo ""
echo "========================================="
echo "Starting Load Test Sequence"
echo "========================================="
echo ""

# Initial status
check_hpa
check_pods

# Phase 1: Warm-up
echo "Phase 1: Warm-up (1000 requests, 10 concurrent)"
echo "----------------------------------------------"
ab -n 1000 -c 10 -q "$BASE_URL/" > /dev/null 2>&1
echo "✓ Warm-up complete"
sleep 5

# Phase 2: Moderate load
echo ""
echo "Phase 2: Moderate Load (10000 requests, 50 concurrent)"
echo "----------------------------------------------"
ab -n 10000 -c 50 -q "$BASE_URL/" > /dev/null 2>&1
echo "✓ Moderate load complete"
check_hpa
check_pods
sleep 10

# Phase 3: Heavy load (this should trigger scaling)
echo ""
echo "Phase 3: Heavy Load - SCALING TRIGGER (50000 requests, 200 concurrent)"
echo "----------------------------------------------"
echo "This will take 2-3 minutes. Watch for pod scaling!"
echo ""
echo "Open another terminal and run:"
echo "  kubectl get hpa flash-tans-hpa -w"
echo "  kubectl get pods -l app=flash-tans -w"
echo ""

ab -n 50000 -c 200 "$BASE_URL/"

echo ""
echo "✓ Heavy load complete"
check_hpa
check_pods

# Phase 4: Sustained load
echo ""
echo "Phase 4: Sustained Load (3 minutes, 150 concurrent)"
echo "----------------------------------------------"
echo "Maintaining high load to keep pods scaled..."
ab -n 100000 -c 150 -t 180 -q "$BASE_URL/" > /dev/null 2>&1
echo "✓ Sustained load complete"

echo ""
echo "========================================="
echo "Load Test Complete!"
echo "========================================="
echo ""
check_hpa
check_pods

echo ""
echo "Next Steps:"
echo "1. Wait 5-10 minutes for cooldown"
echo "2. Watch pods scale back down: kubectl get pods -l app=flash-tans -w"
echo "3. Check Grafana dashboard for metrics: http://${FLOATING_IP}:30030"
echo "4. Take screenshots for your report"
echo ""
