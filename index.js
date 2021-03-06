const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient } = require("mongodb");
require("dotenv").config();
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// stripe
const stripe = require("stripe")(
  "sk_test_51Jx0AjCvip3LZhpPERJsyqojcd723oPTY1FVU7OxHZwnbnqon32WOUDs1hr5P8KDkCTjTL6UQTyuuLvSADV0kX6H00lPEyq4PM"
);

//firebase admin configuration
const admin = require("firebase-admin");
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: serviceAccount.project_id,
    clientEmail: serviceAccount.client_email,
    privateKey: serviceAccount.private_key.replace(/\\n/g, "\n"),
  }),
});

app.get("/", (req, res) => res.send("Kiddies Educare Server is running"));

const verifyIdToken = async (req, res, next) => {
  if (req?.headers?.authorization.startsWith("Bearer ")) {
    const idToken = req.headers.authorization.split("Bearer ")[1];
    try {
      const decodedUser = await admin.auth().verifyIdToken(idToken);
      req.decodedEmail = decodedUser.email;
      next();
    } catch (e) {
      res.status(401).send("Unauthorized");
    }
  }
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.spl8q.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function run() {
  try {
    await client.connect();
    const database = client.db("Kiddies_Educare");
    const userCollection = database.collection("users");
    const eventCollection = database.collection("events");
    const imageCollection = database.collection("gallery");
    const productCollection = database.collection("products");
    const orderCollection = database.collection("orders");
    //post user, get users, get particular user by emailId, replace firebase google sign in or github sign in user info, role play updating for admin, get admin by emailId
    app
      .post("/users", async (req, res) => {
        const user = req.body;
        const result = await userCollection.insertOne(user);
        res.send(result);
      })
      .get("/users", async (req, res) => {
        const result = await userCollection.find({}).toArray();
        res.send(result);
      })
      .get("/users/:emailId", async (req, res) => {
        const result = await userCollection.findOne({
          email: req.params.emailId,
        });
        res.send(result);
      })
      .put("/users", async (req, res) => {
        const result = await userCollection.updateOne(
          { email: req.body.email },
          { $set: req.body },
          { upsert: true }
        );
        res.send(result);
      });

    //post an event, get all event
    app
      .post("/events", async (req, res) => {
        const event = req.body;
        const result = await eventCollection.insertOne(event);
        res.send(result);
      })
      .get("/events", async (req, res) => {
        const result = await eventCollection.find({}).toArray();
        res.send(result);
      });

    //get gallery images, post gallery image
    app
      .get("/gallery", async (req, res) => {
        const result = await imageCollection.find({}).toArray();
        res.send(result);
      })
      .post("/gallery", async (req, res) => {
        const galleryImage = req.body;
        const result = await imageCollection.insertOne(galleryImage);
        res.send(result);
      });

    //get products
    app
      .get("/products", async (req, res) => {
        const result = await productCollection.find({}).toArray();
        res.send(result);
      })
      .post("/products", async (req, res) => {
        const product = req.body;
        const result = await productCollection.insertOne(product);
        res.send(result);
      });

    // payment method
    app.post("/create-payment-intent", async (req, res) => {
      // Create a PaymentIntent with the order amount and currency
      const paymentMoney = req.body.totalAddedProductsPrice.toFixed(2);
      if (paymentMoney) {
        const amount = paymentMoney * 100;
        const paymentIntent = await stripe.paymentIntents.create({
          currency: "usd",
          amount: amount,
          payment_method_types: ["card"],
        });
        res.send({ clientSecret: paymentIntent.client_secret });
      }
    });

    //post order
    app
      .post("/orders", async (req, res) => {
        const order = req.body;
        const result = await orderCollection.insertOne(order);
        res.send(result);
      })
      .get("/orders", async (req, res) => {
        const result = await orderCollection.find({}).toArray();
        res.send(result);
      })
      .get("/orders/:email", verifyIdToken, async (req, res) => {
        if (req.decodedEmail === req.params.email) {
          const result = await orderCollection
            .find({ email: req.params.email })
            .toArray();
          res.send(result);
        } else {
          res.status(401).send("Unauthorized");
        }
      });
  } finally {
    //await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => console.log(`listening to the port on ${port}`));
