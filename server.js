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
} // Fixed: Added missing closing brace

// Root route handler
app.get('/', (req, res) => {
    res.json({ 
        message: 'Delivery Cost API is running!',
        endpoints: {
            test: 'GET /test',
            calculate: 'POST /calculate-delivery-cost'
        }
    });
});

// Find which centers have required products
function findRequiredCenters(order) {
    const requiredCenters = new Set();
    const orderDetails = [];

    for (const [product, quantity] of Object.entries(order)) {
        if (quantity > 0) {
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
                    break;
                }
            }
        }
    }

    return { requiredCenters: Array.from(requiredCenters), orderDetails };
}

// Generate all possible routes through required centers
function generateRoutes(centers) {
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
function calculateRouteCost(route, totalWeight) {
    let totalCost = 0;
    let currentWeight = 0;

    for (let i = 0; i < route.length; i++) {
        const center = route[i];
        let travelDistance;

        if (i === 0) {
            travelDistance = 0;
        } else {
            travelDistance = distances[route[i-1]][center];
        }

        const centerWeight = totalWeight / route.length;
        currentWeight += centerWeight;
        totalCost += calculateCost(currentWeight, travelDistance);
    }

    const lastCenter = route[route.length - 1];
    const finalDistance = distances[lastCenter]['L1'];
    totalCost += calculateCost(totalWeight, finalDistance);
    return totalCost;
}

// Main API endpoint
app.post('/calculate-delivery-cost', (req, res) => {
    try {
        const order = req.body;

        if (!order || typeof order !== 'object') {
            return res.status(400).json({ error: 'Invalid order format' });
        }

        const { requiredCenters, orderDetails } = findRequiredCenters(order);
        if (requiredCenters.length === 0) {
            return res.status(400).json({ error: 'No valid products in order' });
        }

        const totalWeight = orderDetails.reduce((sum, item) => sum + item.totalWeight, 0);
        const possibleRoutes = generateRoutes(requiredCenters);

        let minCost = Infinity;
        let bestRoute = null;
        for (const route of possibleRoutes) {
            const cost = calculateRouteCost(route, totalWeight);
            if (cost < minCost) {
                minCost = cost;
                bestRoute = route;
            }
        }

        res.json({
            minimumCost: Math.round(minCost),
            optimalRoute: bestRoute,
            totalWeight: totalWeight,
            orderDetails: orderDetails
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Test endpoint
app.get('/test', (req, res) => {
    res.json({ message: 'API is working!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
