const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const authMiddleware = require("../middleware/auth");
const isAdmin = require("../middleware/isAdmin");

// GET /api/products - Get all products with optional filtering
router.get("/", async (req, res) => {
  console.log("Fetching products with filters:", req.query);
  try {
    const { search, category, status } = req.query;

    // Build filter object
    const filter = {};

    if (search) {
      filter.$text = { $search: search };
    }

    if (category) {
      filter.category = category;
    }

    if (status) {
      filter.status = status;
    }

    const products = await Product.find(filter).sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// GET /api/products/:id - Get a single product by ID
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json(product);
  } catch (error) {
    console.error("Error fetching product:", error);

    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    res.status(500).json({ error: "Failed to fetch product" });
  }
});

// POST /api/products - Create a new product
router.post("/", authMiddleware, isAdmin, async (req, res) => {
  try {
    const {
      name,
      description,
      price, // Added price
      category,
      brand,
      stock,
      minStock,
      unit,
      weight,
      status,
    } = req.body;

    // Validate required fields
    if (!name || !category || price === undefined) {
      return res.status(400).json({
        error: "Name, category, and price are required fields",
      });
    }

    // Validate price is a positive number
    const parsedPrice = Number(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({
        error: "Price must be a valid positive number",
      });
    }

    const product = new Product({
      name,
      description: description || "",
      price: parsedPrice,
      category,
      brand: brand || "",
      stock: Number(stock) || 0,
      minStock: Number(minStock) || 0,
      unit: unit || "pcs",
      weight: Number(weight) || 0,
      status: status || "active",
    });

    const savedProduct = await product.save();
    res.status(201).json(savedProduct);
  } catch (error) {
    console.error("Error creating product:", error);

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ error: errors.join(", ") });
    }

    res.status(500).json({ error: "Failed to create product" });
  }
});

// PUT /api/products/:id - Update a product
router.put("/:id", authMiddleware, isAdmin, async (req, res) => {
  try {
    const {
      name,
      description,
      price, // Added price
      category,
      brand,
      stock,
      minStock,
      unit,
      weight,
      status,
    } = req.body;

    // Build update object with only provided fields
    const updateData = {};

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) {
      // Validate price is a positive number
      const parsedPrice = Number(price);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({
          error: "Price must be a valid positive number",
        });
      }
      updateData.price = parsedPrice;
    }
    if (category !== undefined) updateData.category = category;
    if (brand !== undefined) updateData.brand = brand;
    if (stock !== undefined) updateData.stock = Number(stock);
    if (minStock !== undefined) updateData.minStock = Number(minStock);
    if (unit !== undefined) updateData.unit = unit;
    if (weight !== undefined) updateData.weight = Number(weight);
    if (status !== undefined) updateData.status = status;

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json(updatedProduct);
  } catch (error) {
    console.error("Error updating product:", error);

    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ error: errors.join(", ") });
    }

    res.status(500).json({ error: "Failed to update product" });
  }
});

// DELETE /api/products/:id - Delete a product
router.delete("/:id", authMiddleware, isAdmin, async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);

    if (!deletedProduct) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Error deleting product:", error);

    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    res.status(500).json({ error: "Failed to delete product" });
  }
});

// POST /api/products/:id/sell - Special endpoint for selling products with price validation
router.post("/:id/sell", authMiddleware, async (req, res) => {
  try {
    const { sellingPrice, quantity = 1 } = req.body;
    
    // Validate required fields
    if (sellingPrice === undefined) {
      return res.status(400).json({ 
        error: "Selling price is required" 
      });
    }

    // Find the product
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Check if product is active
    if (product.status !== "active") {
      return res.status(400).json({ 
        error: "Cannot sell inactive product" 
      });
    }

    // Check stock availability
    if (product.stock < quantity) {
      return res.status(400).json({ 
        error: `Insufficient stock. Available: ${product.stock}` 
      });
    }

    // Validate selling price against defined price
    const parsedSellingPrice = Number(sellingPrice);
    if (isNaN(parsedSellingPrice) || parsedSellingPrice < 0) {
      return res.status(400).json({
        error: "Selling price must be a valid positive number",
      });
    }

    // CRITICAL: Check if selling price is less than defined price
    if (parsedSellingPrice < product.price) {
      return res.status(400).json({
        error: `Cannot sell product at a lower price than the defined price of ${product.price}. Selling price must be at least ${product.price}`,
        definedPrice: product.price,
        attemptedSellingPrice: parsedSellingPrice
      });
    }

    // Calculate total amount
    const totalAmount = parsedSellingPrice * quantity;

    // Update stock (reduce by quantity sold)
    product.stock -= quantity;
    await product.save();

    // Return success response with sale details
    res.json({
      message: "Product sold successfully",
      saleDetails: {
        productId: product._id,
        productName: product.name,
        definedPrice: product.price,
        sellingPrice: parsedSellingPrice,
        quantity: quantity,
        totalAmount: totalAmount,
        remainingStock: product.stock
      }
    });

  } catch (error) {
    console.error("Error selling product:", error);

    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    res.status(500).json({ error: "Failed to process sale" });
  }
});

// GET /api/products/:id/validate-price/:proposedPrice
// Helper endpoint to validate a proposed selling price against defined price
router.get("/:id/validate-price/:proposedPrice", authMiddleware, async (req, res) => {
  try {
    const { id, proposedPrice } = req.params;
    
    const product = await Product.findById(id);
    
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const parsedProposedPrice = Number(proposedPrice);
    
    if (isNaN(parsedProposedPrice) || parsedProposedPrice < 0) {
      return res.status(400).json({
        error: "Proposed price must be a valid positive number",
      });
    }

    const isValid = parsedProposedPrice >= product.price;
    const difference = parsedProposedPrice - product.price;

    res.json({
      productId: product._id,
      productName: product.name,
      definedPrice: product.price,
      proposedPrice: parsedProposedPrice,
      isValid: isValid,
      difference: difference,
      message: isValid 
        ? "Price is valid for sale" 
        : `Price must be at least ${product.price} (currently ${Math.abs(difference)} lower)`
    });

  } catch (error) {
    console.error("Error validating price:", error);
    
    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid product ID" });
    }
    
    res.status(500).json({ error: "Failed to validate price" });
  }
});

module.exports = router;