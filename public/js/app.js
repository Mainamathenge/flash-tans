class FlashTansApp {
    constructor() {
        this.cart = JSON.parse(localStorage.getItem('flashTansCart')) || [];
        this.init();
    }

    init() {
        this.updateCartCount();
        this.bindEvents();
        
        if (window.location.pathname === '/cart') {
            this.renderCart();
        }
    }

    bindEvents() {
        // Add to cart buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('add-to-cart')) {
                const productId = e.target.dataset.id;
                const productName = e.target.dataset.name;
                const productPrice = parseFloat(e.target.dataset.price);
                
                this.addToCart(productId, productName, productPrice);
            }
            
            // Delete product (admin)
            if (e.target.classList.contains('delete-product')) {
                const productId = e.target.dataset.id;
                this.deleteProduct(productId);
            }
            
            // Remove from cart
            if (e.target.classList.contains('remove-from-cart')) {
                const productId = e.target.dataset.id;
                this.removeFromCart(productId);
            }
        });

        // Add product form (admin)
        const addProductForm = document.getElementById('add-product-form');
        if (addProductForm) {
            addProductForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.addProduct(e.target);
            });
        }

        // Checkout form
        const checkoutForm = document.getElementById('checkout-form');
        if (checkoutForm) {
            checkoutForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.checkout(e.target);
            });
        }

        // Quantity changes
        document.addEventListener('change', (e) => {
            if (e.target.classList.contains('cart-quantity')) {
                const productId = e.target.dataset.id;
                const quantity = parseInt(e.target.value);
                this.updateCartQuantity(productId, quantity);
            }
        });
    }

    addToCart(productId, productName, productPrice) {
        const existingItem = this.cart.find(item => item.productId === productId);
        
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            this.cart.push({
                productId,
                productName,
                productPrice,
                quantity: 1
            });
        }
        
        this.saveCart();
        this.updateCartCount();
        this.showNotification('Product added to cart!', 'success');
    }

    removeFromCart(productId) {
        this.cart = this.cart.filter(item => item.productId !== productId);
        this.saveCart();
        this.updateCartCount();
        this.renderCart();
    }

    updateCartQuantity(productId, quantity) {
        const item = this.cart.find(item => item.productId === productId);
        if (item) {
            if (quantity <= 0) {
                this.removeFromCart(productId);
            } else {
                item.quantity = quantity;
                this.saveCart();
                this.renderCart();
            }
        }
    }

    renderCart() {
        const cartItemsContainer = document.getElementById('cart-items');
        const cartTotalElement = document.getElementById('cart-total');
        const checkoutBtn = document.getElementById('checkout-btn');
        
        if (!cartItemsContainer) return;

        if (this.cart.length === 0) {
            cartItemsContainer.innerHTML = '<p class="text-center">Your cart is empty</p>';
            cartTotalElement.textContent = '$0.00';
            checkoutBtn.disabled = true;
            return;
        }

        let total = 0;
        const cartHTML = this.cart.map(item => {
            const itemTotal = item.productPrice * item.quantity;
            total += itemTotal;
            
            return `
                <div class="card mb-3">
                    <div class="card-body">
                        <div class="row align-items-center">
                            <div class="col-md-6">
                                <h6>${item.productName}</h6>
                                <p class="text-muted">${item.productPrice}</p>
                            </div>
                            <div class="col-md-3">
                                <input type="number" class="form-control cart-quantity" 
                                       value="${item.quantity}" min="1" 
                                       data-id="${item.productId}">
                            </div>
                            <div class="col-md-2">
                                <strong>${itemTotal.toFixed(2)}</strong>
                            </div>
                            <div class="col-md-1">
                                <button class="btn btn-sm btn-danger remove-from-cart" 
                                        data-id="${item.productId}">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        cartItemsContainer.innerHTML = cartHTML;
        cartTotalElement.textContent = `${total.toFixed(2)}`;
        checkoutBtn.disabled = false;
    }

    async checkout(form) {
        const formData = new FormData(form);
        const customerInfo = {
            name: formData.get('name'),
            email: formData.get('email'),
            address: formData.get('address')
        };

        const orderData = {
            items: this.cart.map(item => ({
                productId: item.productId,
                quantity: item.quantity
            })),
            customerInfo
        };

        try {
            const response = await fetch('/api/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(orderData)
            });

            const result = await response.json();

            if (response.ok) {
                this.cart = [];
                this.saveCart();
                this.updateCartCount();
                this.showNotification('Order placed successfully!', 'success');
                form.reset();
                this.renderCart();
            } else {
                this.showNotification(result.error || 'Order failed', 'error');
            }
        } catch (error) {
            this.showNotification('Network error', 'error');
        }
    }

    async addProduct(form) {
        const formData = new FormData(form);
        const productData = {
            name: formData.get('name'),
            price: formData.get('price'),
            description: formData.get('description'),
            stock: formData.get('stock')
        };

        try {
            const response = await fetch('/api/products', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(productData)
            });

            if (response.ok) {
                this.showNotification('Product added successfully!', 'success');
                form.reset();
                setTimeout(() => window.location.reload(), 1000);
            } else {
                const result = await response.json();
                this.showNotification(result.error || 'Failed to add product', 'error');
            }
        } catch (error) {
            this.showNotification('Network error', 'error');
        }
    }

    async deleteProduct(productId) {
        if (!confirm('Are you sure you want to delete this product?')) return;

        try {
            const response = await fetch(`/api/products/${productId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.showNotification('Product deleted successfully!', 'success');
                setTimeout(() => window.location.reload(), 1000);
            } else {
                this.showNotification('Failed to delete product', 'error');
            }
        } catch (error) {
            this.showNotification('Network error', 'error');
        }
    }

    saveCart() {
        localStorage.setItem('flashTansCart', JSON.stringify(this.cart));
    }

    updateCartCount() {
        const cartCount = document.getElementById('cart-count');
        if (cartCount) {
            const totalItems = this.cart.reduce((sum, item) => sum + item.quantity, 0);
            cartCount.textContent = totalItems;
        }
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `alert alert-${type === 'success' ? 'success' : 'danger'} alert-dismissible fade show position-fixed`;
        notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999;';
        notification.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    new FlashTansApp();
});