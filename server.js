// an express server that hosts index.html and serves the static files in the public directory

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import dotenv from "dotenv";
import fetch from "node-fetch";
import OpenAI from "openai";

const app = express();
app.use(express.json());
dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SEARCH_URL = process.env.quoordinates_server;
const RANDOM_URL = process.env.quoordinates_server_random;

app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// post body.text to the server
app.post("/query", (req, res) => {
  const { text } = req.body;
  console.log(text);

  fetch(SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: text }),
  })
    .then((response) => response.json())
    .then((data) => {
      console.log(data);
      res.json(data);
    })
    .catch((error) => {
      console.error("Error:", error);
      res.json({ status: "error" });
    });
});

async function stream(quote) {
  const prompt = `I only have the following quote, recreate outside context using concepts from the world. Do a breadth first search of external data. This means that you are **not rephrasing the content in the quote**. You are pulling in examples and information from the world **outside the set** of the quote. Do not bother repeating or rehashing the quote.\n\nQuote:\n${quote}`;
  const completion = openai.chat.completions.create({
    model: "gpt-4-turbo",
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: prompt },
    ],
    stream: true,
  });

  return completion;
}

app.get("/events", async (req, res) => {
  // get quote from url query
  /* it comes in like 

   var eventSource = new EventSource("/events?payload=" + highlightedText, {
        withCredentials: true,
      });
      */
  const quote = req.query.payload;
    console.log(quote);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const completion = await stream(quote);
  for await (const chunk of completion) {
    if (chunk.choices[0].delta.content === undefined) {
      break;
    }
    console.log(chunk.choices[0].delta.content);
    sendEvent(chunk.choices[0].delta.content);
  }
});

app.listen(3000, () => {
  console.log("Server started on http://localhost:3000");
});
