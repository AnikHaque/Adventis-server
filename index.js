const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const app = express();
const port = 8800;

const JWT_SECRET = "1234556";

app.use(express.json());
app.use(cors());

const uri =
  "mongodb+srv://freelance:SJ5HW66Mk5XOobot@cluster0.ahhvv5a.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(403).send("Unauthorized");
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).send("Invalid token");
  }
}

async function run() {
  try {
    const db = client.db("freelance-marketplace");
    const users = db.collection("users");
    const tasks = db.collection("tasks");
    const events = db.collection("events");
    const bookings = db.collection("bookings");

    // Add event
    app.post("/api/add-event", verifyToken, async (req, res) => {
      const { title, category, description, date, picture, location } =
        req.body;
      const user = req.user;

      try {
        const event = await events.insertOne({
          title,
          category,
          description,
          date,
          picture,
          location,
          email: user.email,
          createdBy: user.name,
        });
        res.status(201).json({ message: "Event created successfully", event });
      } catch (err) {
        res.status(500).json({ message: "Error creating event" });
      }
    });

    // GET all events
    app.get("/api/events", async (req, res) => {
      try {
        const db = client.db("freelance-marketplace");
        const events = await db.collection("events").find().toArray();
        res.status(200).json(events);
      } catch (error) {
        console.error("Error fetching events:", error);
        res.status(500).json({ message: "Error fetching events" });
      }
    });

    // GET event by ID
    app.get("/api/events/:id", async (req, res) => {
      try {
        const db = client.db("freelance-marketplace");
        const event = await db
          .collection("events")
          .findOne({ _id: new ObjectId(req.params.id) });

        if (!event) {
          return res.status(404).json({ message: "Event not found" });
        }

        res.status(200).json(event);
      } catch (error) {
        console.error("Error fetching event by ID:", error);
        res.status(500).json({ message: "Error fetching event details" });
      }
    });

    // GET featured events
    app.get("/api/featured", async (req, res) => {
      try {
        const db = client.db("freelance-marketplace");
        const events = await db
          .collection("events")
          .find()
          .sort({ date: 1 }) // sort by soonest deadlines
          .limit(6) // return only 6 tasks
          .toArray();

        res.status(200).json(events);
      } catch (error) {
        console.error("Error fetching events:", error);
        res.status(500).json({ message: "Error fetching events" });
      }
    });

    // GET my-events
    app.get("/api/my-events", verifyToken, async (req, res) => {
      try {
        const userEmail = req.user.email;

        const eventsList = await events.find({ email: userEmail }).toArray();

        const eventsWithUserName = await Promise.all(
          eventsList.map(async (event) => {
            const user = await users.findOne({ email: event.email });
            return {
              ...event,
              name: user?.name || "", // Add the user name to the task data
            };
          })
        );

        res.status(200).json(eventsWithUserName);
      } catch (error) {
        console.error("Error fetching user's events:", error);
        res.status(500).json({ message: "Error fetching events" });
      }
    });

    // Update my-events
    app.put("/api/events/:id", verifyToken, async (req, res) => {
      const { title, category, description, date, picture } = req.body;
      const eventId = req.params.id;
      const userEmail = req.user.email;
      const userName = req.user.name;

      try {
        const event = await events.findOne({ _id: new ObjectId(eventId) });
        if (!event) {
          return res.status(404).json({ message: "Event not found" });
        }

        if (event.email !== userEmail) {
          return res
            .status(403)
            .json({ message: "You can only update your own events" });
        }

        if (event.name !== userName) {
          return res
            .status(403)
            .json({ message: "You can only update your own events" });
        }

        // Update task data in the database
        await events.updateOne(
          { _id: new ObjectId(eventId) },
          {
            $set: {
              title,
              category,
              description,
              date,
              picture,
            },
          }
        );

        // Send a success response
        res.status(200).json({ message: "event updated successfully" });
      } catch (error) {
        console.error("Error updating event:", error);
        res.status(500).json({ message: "Error updating event" });
      }
    });

    // Delete my-events
    app.delete("/api/events/:id", verifyToken, async (req, res) => {
      const eventId = req.params.id;
      const userEmail = req.user.email;

      try {
        const event = await events.findOne({ _id: new ObjectId(eventId) });
        if (!event) {
          return res.status(404).json({ message: "Event not found" });
        }

        // Ensure the user can only delete their own tasks
        if (event.email !== userEmail) {
          return res
            .status(403)
            .json({ message: "You can only delete your own events" });
        }

        await events.deleteOne({ _id: new ObjectId(eventId) });

        res.status(200).json({ message: "Event deleted successfully" });
      } catch (error) {
        console.error("Error deleting event:", error);
        res.status(500).json({ message: "Error deleting event" });
      }
    });

    // Add bookings
    app.post("/api/bookings", verifyToken, async (req, res) => {
      const { eventId } = req.body;
      const userEmail = req.user.email;

      try {
        // Check if already booked
        const existing = await bookings.findOne({
          eventId: new ObjectId(eventId),
          userEmail,
        });
        if (existing) {
          return res
            .status(400)
            .json({ message: "You have already booked this task." });
        }

        const booking = await bookings.insertOne({
          eventId: new ObjectId(eventId),
          userEmail,
          createdAt: new Date(),
        });

        res.status(201).json({ message: "Event booked successfully", booking });
      } catch (err) {
        console.error("Booking error:", err);
        res.status(500).json({ message: "Error booking event" });
      }
    });

    // Get my-bookings
    app.get("/api/my-bookings", verifyToken, async (req, res) => {
      const userEmail = req.user.email;

      try {
        const bookedEvents = await bookings
          .aggregate([
            {
              $match: { userEmail },
            },
            {
              $lookup: {
                from: "events",
                localField: "eventId",
                foreignField: "_id",
                as: "eventDetails",
              },
            },
            {
              $unwind: "$eventDetails",
            },
            {
              $project: {
                _id: 1,
                eventId: 1,
                userEmail: 1,
                bookedAt: "$createdAt",
                event: "$eventDetails",
              },
            },
          ])
          .toArray();

        res.status(200).json(bookedEvents);
      } catch (err) {
        console.error("Error fetching bookings:", err);
        res.status(500).json({ message: "Error fetching bookings" });
      }
    });

    // Delete bookings
    app.delete("/api/bookings/:id", verifyToken, async (req, res) => {
      const bookingId = req.params.id;
      const userEmail = req.user.email;

      try {
        const result = await bookings.deleteOne({
          _id: new ObjectId(bookingId),
          userEmail: userEmail, // ensure user owns this booking
        });

        if (result.deletedCount === 0) {
          return res
            .status(404)
            .json({ message: "Booking not found or not authorized" });
        }

        res.status(200).json({ message: "Booking deleted successfully" });
      } catch (error) {
        console.error("Error deleting booking:", error);
        res.status(500).json({ message: "Error deleting booking" });
      }
    });

    // GET task by ID
    app.get("/api/tasks/:id", async (req, res) => {
      try {
        const db = client.db("freelance-marketplace");
        const task = await db
          .collection("tasks")
          .findOne({ _id: new ObjectId(req.params.id) });

        if (!task) {
          return res.status(404).json({ message: "Task not found" });
        }

        res.status(200).json(task);
      } catch (error) {
        console.error("Error fetching task by ID:", error);
        res.status(500).json({ message: "Error fetching task details" });
      }
    });

    // Signup
    app.post("/api/register", async (req, res) => {
      const { name, email, password, photoURL } = req.body;

      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z]).{6,}$/;
      if (!passwordRegex.test(password)) {
        return res.status(400).json({
          message:
            "Password must have an uppercase letter, a lowercase letter, and be at least 6 characters long.",
        });
      }

      try {
        const existingUser = await users.findOne({ email });
        if (existingUser) {
          return res.status(409).json({ message: "User already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await users.insertOne({
          name,
          email,
          password: hashedPassword,
          photoURL: photoURL || "",
          createdAt: new Date(),
        });

        const token = jwt.sign({ id: result.insertedId, email }, JWT_SECRET, {
          expiresIn: "7d",
        });

        res
          .status(201)
          .json({ message: "User registered successfully", token });
      } catch (err) {
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // Login
    app.post("/api/login", async (req, res) => {
      const { email, password } = req.body;

      try {
        const user = await users.findOne({ email });
        if (!user) {
          return res.status(400).send("User not found");
        }

        // Verify password (assumes bcrypt is used)
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          return res.status(400).send("Invalid credentials");
        }

        // Create JWT token
        const token = jwt.sign(
          { id: user._id, email: user.email },
          JWT_SECRET,
          { expiresIn: "1h" }
        );

        res.json({ token, user });
      } catch (err) {
        res.status(500).send("Server error");
      }
    });

    // Save user
    app.post("/api/save-user", async (req, res) => {
      const { name, email, photoURL } = req.body;

      try {
        let user = await users.findOne({ email });

        if (!user) {
          const result = await users.insertOne({
            name,
            email,
            photoURL: photoURL || "",
            createdAt: new Date(),
          });
          user = await users.findOne({ _id: result.insertedId });
        }

        const token = jwt.sign({ id: user._id, email }, JWT_SECRET, {
          expiresIn: "7d",
        });

        res.status(200).json({ message: "User saved", token });
      } catch (err) {
        console.error("Save Google user error:", err);
        res.status(500).json({ message: "Internal server error" });
      }
    });
  } catch (err) {
    console.error("Error connecting to MongoDB:", err);
  }
}

run().catch(console.dir);

//  Root route to check DB connection
app.get("/", async (req, res) => {
  try {
    await client.db("admin").command({ ping: 1 });
    res.send(" MongoDB is connected. Server is running on port " + port);
  } catch (error) {
    res.status(500).send(" MongoDB connection failed: " + error.message);
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
