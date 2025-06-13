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
    // await client.connect();
    // console.log("✅ Connected to MongoDB");

    const db = client.db("freelance-marketplace");
    const users = db.collection("users");
    const tasks = db.collection("tasks");
    const events = db.collection("events");
    const bookings = db.collection("bookings");

    const bids = db.collection("bids");

    app.get("/api/my-tasks", verifyToken, async (req, res) => {
      try {
        const userEmail = req.user.email;

        // Fetch tasks based on user's email
        const tasksList = await tasks.find({ email: userEmail }).toArray();

        // Fetch the user details for each task
        const tasksWithUserName = await Promise.all(
          tasksList.map(async (task) => {
            // Fetch user by email (or _id if using user ID)
            const user = await users.findOne({ email: task.email });
            return {
              ...task,
              name: user?.name || "", // Add the user name to the task data
            };
          })
        );

        // Send back the tasks with user names included
        res.status(200).json(tasksWithUserName);
      } catch (error) {
        console.error("Error fetching user's tasks:", error);
        res.status(500).json({ message: "Error fetching tasks" });
      }
    });

    app.get("/api/my-events", verifyToken, async (req, res) => {
      try {
        const userEmail = req.user.email;

        // Fetch tasks based on user's email
        const eventsList = await events.find({ email: userEmail }).toArray();

        // Fetch the user details for each task
        const eventsWithUserName = await Promise.all(
          eventsList.map(async (event) => {
            // Fetch user by email (or _id if using user ID)
            const user = await users.findOne({ email: event.email });
            return {
              ...event,
              name: user?.name || "", // Add the user name to the task data
            };
          })
        );

        // Send back the tasks with user names included
        res.status(200).json(eventsWithUserName);
      } catch (error) {
        console.error("Error fetching user's events:", error);
        res.status(500).json({ message: "Error fetching events" });
      }
    });

    app.put("/api/events/:id", verifyToken, async (req, res) => {
      const { title, category, description, date, picture } = req.body;
      const eventId = req.params.id;
      const userEmail = req.user.email; // Email from token
      const userName = req.user.name; // Name from token

      try {
        // Check if the task exists
        const event = await events.findOne({ _id: new ObjectId(eventId) });
        if (!event) {
          return res.status(404).json({ message: "Event not found" });
        }

        // Ensure the user is trying to update their own task
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

    app.delete("/api/tasks/:id", verifyToken, async (req, res) => {
      const taskId = req.params.id;
      const userEmail = req.user.email;

      try {
        const task = await tasks.findOne({ _id: new ObjectId(taskId) });
        if (!task) {
          return res.status(404).json({ message: "Task not found" });
        }

        // Ensure the user can only delete their own tasks
        if (task.email !== userEmail) {
          return res
            .status(403)
            .json({ message: "You can only delete your own tasks" });
        }

        await tasks.deleteOne({ _id: new ObjectId(taskId) });

        res.status(200).json({ message: "Task deleted successfully" });
      } catch (error) {
        console.error("Error deleting task:", error);
        res.status(500).json({ message: "Error deleting task" });
      }
    });

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

    const { ObjectId } = require("mongodb");

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

    app.get("/api/bids/:taskId", verifyToken, async (req, res) => {
      const { taskId } = req.params;
      try {
        const bids = await db
          .collection("bids")
          .aggregate([
            {
              $match: { taskId: new ObjectId(taskId) },
            },
            {
              $lookup: {
                from: "users",
                localField: "userEmail",
                foreignField: "email",
                as: "userDetails",
              },
            },
            {
              $unwind: "$userDetails",
            },
            {
              $project: {
                _id: 1,
                userEmail: 1,
                bidderName: "$userDetails.name",
                amount: 1,
                message: 1,
              },
            },
          ])
          .toArray();

        // Count the number of bids for the task
        const bidCount = bids.length;

        if (bids.length === 0) {
          return res
            .status(404)
            .json({ message: "No bids found for this task" });
        }

        res.status(200).json({
          bids,
          bidCount, // Include the bid count in the response
        }); // Send the bids with bidder info and count in the response
      } catch (error) {
        console.error("Error fetching bids:", error);
        res.status(500).json({ message: "Error fetching bids" });
      }
    });

    // Add event
    app.post("/api/add-event", verifyToken, async (req, res) => {
      const { title, category, description, date, picture } = req.body;
      const user = req.user;

      try {
        const event = await events.insertOne({
          title,
          category,
          description,
          date,
          picture,
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

    // GET top 6 tasks sorted by upcoming date
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

    // Other routes and logic...
  } catch (err) {
    console.error("❌ Error connecting to MongoDB:", err);
  }
}

run().catch(console.dir);

// 🌐 Root route to check DB connection
app.get("/", async (req, res) => {
  try {
    await client.db("admin").command({ ping: 1 });
    res.send(" MongoDB is connected. Server is running on port " + port);
  } catch (error) {
    res.status(500).send(" MongoDB connection failed: " + error.message);
  }
});

// 🚀 Start the server
app.listen(port, () => {
  console.log(`🚀 Server is running on http://localhost:${port}`);
});
