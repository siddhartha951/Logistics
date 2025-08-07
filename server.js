const express = require('express');
const app = express();

app.use(express.json());

// Distance matrix between centers and L1
const distances = {
    'C1': { 'C2': 3, 'C3': 2, 'L1': 4 },
    'C2': { 'C1': 3, 'C3': 3, 'L1': 2.5 },
    'C3': { 'C1': 2, 'C2': 3, 'L1': 3 }
};

// Inventory and weights
const inventory = {
    'C1': { 'A': 3, 'B': 2, 'C': 8 },
    'C2': { 'D': 12, 'E': 25, 'F': 15 },
    'C3': { 'G': 0.5, 'H': 1, 'I': 2 }
};

// Calculate cost based on weight and distance
function calculateCost(weight, distance) {
    const baseCost = 10 * distance;
    const additionalWeight = Math.max(0, weight - 0.5);
    const additionalCost = Math.ceil(additionalWeight / 5) * 8 * distance;
    return baseCost + additionalCost;
}

// Root route handler
app.get('/', (req, res) => {
    res.json({ 
        message: 'Logistics Delivery Cost API is running successfully!',
        version: '1.0.0',
        endpoints: {
            test: 'GET /test',
            calculate: 'POST /calculate-delivery-cost'
        },
        availableProducts: {
            'C1': ['A', 'B', 'C'],
            'C2': ['D', 'E', 'F'],
            'C3': ['G', 'H', 'I']
        },
        sampleRequest: {
            "A": 2,
            "D": 1,
            "G": 3
        }
    });
});

// Find which centers have required products
function findRequiredCenters(order) {
    const requiredCenters = new Set();
    const orderDetails = [];
    
    console.log('Processing order:', order);

    for (const [product, quantity] of Object.entries(order)) {
        if (quantity > 0) {
            let productFound = false;
            for (const [center, products] of Object.entries(inventory)) {
                if (products[product] !== undefined) {
                    requiredCenters.add(center);
                    orderDetails.push({
                        product,
                        quantity,
                        center,
                        unitWeight: products[product],
                        totalWeight: products[product] * quantity
                    });
                    productFound = true;
                    break;
                }
            }
            if (!productFound) {
                console.log(`Product ${product} not found in inventory`);
            }
        }
    }

    console.log('Required centers:', Array.from(requiredCenters));
    console.log('Order details:', orderDetails);

    return { requiredCenters: Array.from(requiredCenters), orderDetails };
}

// Generate all possible routes through required centers
function generateRoutes(centers) {
    if (centers.length === 0) {
        return [];
    }
    
    if (centers.length === 1) {
        return [[centers[0]]];
    }

    const routes = [];

    function permute(arr, current = []) {
        if (arr.length === 0) {
            routes.push([...current]);
            return;
        }

        for (let i = 0; i < arr.length; i++) {
            const next = arr[i];
            const remaining = arr.slice(0, i).concat(arr.slice(i + 1));
            permute(remaining, current.concat(next));
        }
    }

    permute(centers);
    return routes;
}

// Calculate total cost for a specific route
function calculateRouteCost(route, orderDetails) {
    let totalCost = 0;
    
    // Calculate cost for traveling between centers and collecting items
    for (let i = 0; i < route.length; i++) {
        const center = route[i];
        
        // Find items to collect from this center
        const centerItems = orderDetails.filter(item => item.center === center);
        const centerWeight = centerItems.reduce((sum, item) => sum + item.totalWeight, 0);
        
        // Calculate travel distance to this center
        let travelDistance = 0;
        if (i > 0) {
            const prevCenter = route[i - 1];
            travelDistance = distances[prevCenter][center];
        }
        
        // Add cost for traveling to center and handling items
        if (centerWeight > 0) {
            totalCost += calculateCost(centerWeight, travelDistance);
        }
    }

    // Add final delivery cost from last center to L1
    const lastCenter = route[route.length - 1];
    const totalWeight = orderDetails.reduce((sum, item) => sum + item.totalWeight, 0);
    const finalDistance = distances[lastCenter]['L1'];
    totalCost += calculateCost(totalWeight, finalDistance);
    
    return totalCost;
}

// Main API endpoint
app.post('/calculate-delivery-cost', (req, res) => {
    try {
        console.log('Received request body:', req.body);
        
        const order = req.body;

        if (!order || typeof order !== 'object' || Object.keys(order).length === 0) {
            return res.status(400).json({ 
                error: 'Invalid order format. Please provide a valid order object.',
                example: { "A": 2, "D": 1 }
            });
        }

        const { requiredCenters, orderDetails } = findRequiredCenters(order);
        
        if (requiredCenters.length === 0 || orderDetails.length === 0) {
            return res.status(400).json({ 
                error: 'No valid products found in order',
                availableProducts: {
                    'C1': ['A', 'B', 'C'],
                    'C2': ['D', 'E', 'F'],
                    'C3': ['G', 'H', 'I']
                },
                receivedOrder: order
            });
        }

        const totalWeight = orderDetails.reduce((sum, item) => sum + item.totalWeight, 0);
        const possibleRoutes = generateRoutes(requiredCenters);

        console.log('Possible routes:', possibleRoutes);

        let minCost = Infinity;
        let bestRoute = null;
        
        for (const route of possibleRoutes) {
            const cost = calculateRouteCost(route, orderDetails);
            console.log(`Route ${route.join(' -> ')} costs: ${cost}`);
            
            if (cost < minCost) {
                minCost = cost;
                bestRoute = route;
            }
        }

        const response = {
            success: true,
            minimumCost: Math.round(minCost * 100) / 100, // Round to 2 decimal places
            optimalRoute: bestRoute,
            routeDescription: `${bestRoute.join(' → ')} → L1`,
            totalWeight: totalWeight,
            orderDetails: orderDetails,
            centersRequired: requiredCenters
        };

        console.log('Sending response:', response);
        res.json(response);
        
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Test endpoint
app.get('/test', (req, res) => {
    res.json({ 
        message: 'API is working perfectly!',
        timestamp: new Date().toISOString(),
        server: 'Logistics API v1.0'
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// 404 handler for undefined routes
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Route not found',
        availableRoutes: [
            'GET /',
            'GET /test',
            'GET /health',
            'POST /calculate-delivery-cost'
        ]
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        error: 'Something went wrong!',
        message: error.message
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Logistics API Server is running on port ${PORT}`);
    console.log(`🌐 Server URL: http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
});
