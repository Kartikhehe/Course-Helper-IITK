import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import pkg from "pg"; // Import the default export
const { Pool } = pkg; // Destructure Pool from the imported package
import jwt from "jsonwebtoken"
import bcrypt from "bcryptjs"
import { authenticateToken } from "./middlewares/authMiddleware.js";
import dotenv from "dotenv";
dotenv.config();




const app = express();
const pool = new Pool({
    connectionString: process.env.connectionString,
    max: 10, // Maximum number of connections in the pool
    idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
    connectionTimeoutMillis: 2000, // Return an error if a connection isn't acquired in 2 seconds

  });

// Middleware
app.use(cors({origin: "*",}));
app.use(bodyParser.json());



// const router = express.Router();

// Public route
// router.get('/', getAllCourses);

// // Protected routes
// router.post('/', authenticateToken, addCourse);    // Add a new course
// router.put('/:id', authenticateToken, updateCourse); // Update a course
// router.delete('/:id', authenticateToken, deleteCourse); // Delete a course



//getting a simple message when we try to get to the root route.
app.get("/", async (req, res) => {
  try {
    res.json("Our backend is running!"); 
    // res.redirect("/courses");// Sends a plain message
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Server error");
  }
});


// Fetch all courses
app.get("/courses", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM myschema.courses");
    res.json(result.rows);
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Server error");
  }
});

// Add a new course
app.post("/courses", authenticateToken, async (req, res) => {
    const { name, code, description, credit, image } = req.body;

    if (!name || !code || !description || !credit || !image) {
        return res.status(400).json({ error: "All fields must be provided" });
    }

    try {
        const result = await pool.query(
            `INSERT INTO myschema.courses ( name, code, description, credit, image)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [name, code, description, credit, image]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("Error details:", err); // Log the full error object
      res.status(500).json({ error: "Failed to add course" });
  }
  
});

// Update a course
app.put("/courses/:id", authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { name, code, description, credit, image } = req.body;
  
    
  
    if (!name || !code || !description || !credit || !image) {
      return res.status(400).json({ error: "All fields must be provided" });
    }
  
    try {
      const result = await pool.query(
        `UPDATE myschema.courses
         SET name = $1, code = $2, description = $3, credit = $4, image = $5
         WHERE id = $6
         RETURNING *`,
        [name, code, description, credit, image, id]
      );
  
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Course not found" });
      }
  
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ error: "Failed to update course" });
    }
  });
  

/// Delete a course
app.delete("/courses/:id", authenticateToken, async (req, res) => {
    const { id } = req.params;
    
    console.log("Deleting course with ID:", id);  // Log the course ID
  
    try {
      const result = await pool.query(
        "DELETE FROM myschema.courses WHERE id = $1 RETURNING *",
        [id]
      );
  
      if (result.rows.length === 0) {
        return res.status(404).send("Course not found");
      }
  
      res.send("Course deleted successfully");
    } catch (error) {
      console.error(error.message);
      res.status(500).send("Server error");
    }
  });

  
  
  app.post('/register', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user into the database
        await pool.query(
            'INSERT INTO myschema.auth (username, password) VALUES ($1, $2)',
            [username, hashedPassword]
        );

        res.status(201).json({ message: 'User registered successfully' });
        console.log('User registered:', username);
    } catch (error) {
        if (error.code === '23505') { // Unique constraint violation
            return res.status(400).json({ message: 'Username already exists' });
        }
        console.error("Error during registration:", error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});



const generateToken = (payload) => {
    const secretKey = process.env.SuperSecretKey; // Replace with your actual secret
    const expiration = "1h"; // Token will expire in 1 hour

    return jwt.sign(payload, secretKey, { expiresIn: expiration });
};



app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
      const user = await pool.query('SELECT * FROM myschema.auth WHERE username = $1', [username]);

      if (!user.rows.length) {
          return res.status(400).json({ message: 'User not found' });
      }

      const validPassword = await bcrypt.compare(password, user.rows[0].password);
      if (!validPassword) {
          return res.status(400).json({ message: 'Invalid password' });
      }

      const token = generateToken({ id: user.rows[0].id, username: user.rows[0].username });
      res.json({ token });
  } catch (error) {
      res.status(500).json({ message: 'Internal Server Error' });
  }
});





  

// Start server
const PORT = process.env.PORT || 1050;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

export default app;