import dotenv from "dotenv";
dotenv.config();
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { authenticateToken } from "./middlewares/authMiddleware.js";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Cloudinary config
import { v2 as cloudinary } from "cloudinary";
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer config
const storage = multer.memoryStorage();
const upload = multer({ storage });

const app = express();

// Middleware
app.use(cors({ origin: "*" }));
app.use(bodyParser.json());

app.post("/upload-image", upload.single("image"), async (req, res) => {
  try {
    const fileStr = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    const uploadedResponse = await cloudinary.uploader.upload(fileStr, {
      folder: "courses",
    });
    res.status(200).json({ imageUrl: uploadedResponse.secure_url });
  } catch (err) {
    console.error("Cloudinary Upload Error:", err);
    res.status(500).json({ error: "Image upload failed" });
  }
});

app.get("/", async (req, res) => {
  try {
    res.json("Our backend is running!");
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Server error");
  }
});

app.get("/courses", async (req, res) => {
  try {
    const { data, error } = await supabase.from("courses").select("*");
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Server error");
  }
});

app.post("/courses", authenticateToken, async (req, res) => {
  const { name, code, description, credit, image } = req.body;

  if (!name || !code || !description || !credit || !image) {
    return res.status(400).json({ error: "All fields must be provided" });
  }

  try {
    const { data, error } = await supabase

      
      .from("courses")
      .insert([{ name, code, description, credit, image }])
      .select();

    if (error) {
      if (error.code === "23505") {
        return res.status(400).json({ error: "Course with this code already exists" });
      }
      throw error;
    }

    res.status(201).json(data[0]);
  } catch (err) {
    console.error("Error details:", err);
    res.status(500).json({ error: "Failed to add course" });
  }
});

app.put("/courses/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, code, description, credit, image } = req.body;

  if (!name || !code || !description || !credit || !image) {
    return res.status(400).json({ error: "All fields must be provided" });
  }

  try {
    const { data, error } = await supabase
      
      .from("courses")
      .update({ name, code, description, credit, image })
      .eq("id", id)
      .select();

    if (error) throw error;
    if (data.length === 0) {
      return res.status(404).json({ error: "Course not found" });
    }

    res.json(data[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to update course" });
  }
});

app.delete("/courses/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;

  console.log("Deleting course with ID:", id);

  try {
    const { data, error } = await supabase
      
      .from("courses")
      .delete()
      .eq("id", id)
      .select();

    if (error) throw error;

    if (data.length === 0) {
      return res.status(404).send("Course not found");
    }

    res.send("Course deleted successfully");
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Server error");
  }
});

app.post("/register", async (req, res) => {
  const { username, password } = req.body;

  try {
    const { data, error } = await supabase.auth.signUp({
      email: username,
      password,
    });

    if (error) {
      if (error.message.includes("already registered")) {
        return res.status(400).json({ message: "Username already exists" });
      }
      throw error;
    }

    res.status(201).json({ message: "User registered successfully" });
    console.log("User registered:", username);
  } catch (error) {
    console.error("Error during registration:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

const generateToken = (payload) => {
  const secretKey = process.env.SuperSecretKey;
  const expiration = "1h";
  return jwt.sign(payload, secretKey, { expiresIn: expiration });
};

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: username,
      password,
    });

    if (error) {
      if (error.message.includes("Invalid login credentials")) {
        return res.status(400).json({ message: "Invalid credentials" });
      }
      throw error;
    }

    const token = data.session.access_token;
    res.json({ token });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});


// =====================
// === Ratings Section ===
// =====================

// // Add or update rating
// app.post('/ratings', authenticateToken, async (req, res) => {
//   const { course_id, rating } = req.body;
//   const user_id = req.user.id;

//   if (!course_id || !rating || rating < 1 || rating > 5) {
//     return res.status(400).json({ message: "Invalid rating or course ID" });
//   }

//   try {
//     const result = await pool.query(
//       `INSERT INTO myschema.ratings (user_id, course_id, rating)
//        VALUES ($1, $2, $3)
//        ON CONFLICT (user_id, course_id)
//        DO UPDATE SET rating = EXCLUDED.rating
//        RETURNING *`,
//       [user_id, course_id, rating]
//     );

//     res.status(201).json(result.rows[0]);
//   } catch (err) {
//     console.error("Error adding/updating rating:", err);
//     res.status(500).json({ message: "Internal Server Error" });
//   }
// });

// // Get average rating and user's rating for a course
// app.get('/ratings/:courseId', authenticateToken, async (req, res) => {
//   const course_id = req.params.courseId;
//   const user_id = req.user.id;

//   try {
//     const avgResult = await pool.query(
//       `SELECT AVG(rating)::numeric(10,2) AS avg_rating FROM myschema.ratings WHERE course_id = $1`,
//       [course_id]
//     );

//     const userResult = await pool.query(
//       `SELECT rating FROM myschema.ratings WHERE course_id = $1 AND user_id = $2`,
//       [course_id, user_id]
//     );

//     res.json({
//       avg_rating: avgResult.rows[0].avg_rating || 0,
//       user_rating: userResult.rows[0]?.rating || null,
//     });
//   } catch (err) {
//     console.error("Error fetching ratings:", err);
//     res.status(500).json({ message: "Internal Server Error" });
//   }
// });

// Start server
const PORT = process.env.PORT || 1450;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

export default app;
