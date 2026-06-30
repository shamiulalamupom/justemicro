import express from "express";

const app = express();
app.use(express.json());

const events = [
  { id: 1, name: "Borderland", disponibility: 10 },
  { id: 2, name: "The builder", disponibility: 5 },
  { id: 3, name: "Chaplin", disponibility: 15 },
];

const reservations = {};

// consultation des événements
app.get("/events", (req, res) => {
  try {
    res.json(events);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// réservation temporaire d'une place
app.post("/events/:id/reserve-temp", (req, res) => {
  try {
    const event = events.find((e) => e.id === parseInt(req.params.id));
    if (!event) return res.status(404).json({ error: "Event not found" });
    if (event.disponibility <= 0)
      return res.status(400).json({ error: "No availability" });

    const reservationId = Date.now().toString();
    reservations[reservationId] = { eventId: event.id, status: "temporary" };
    event.disponibility--;

    res.json({ reservationId, message: "Temporary reservation created" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// confirmation définitive d'une réservation
app.post("/reservations/:id/confirm", (req, res) => {
  try {
    const reservation = reservations[req.params.id];
    if (!reservation)
      return res.status(404).json({ error: "Reservation not found" });
    if (reservation.status === "confirmed")
      return res.json({ message: "Reservation already confirmed" });
    if (reservation.status !== "temporary")
      return res
        .status(409)
        .json({ error: `Cannot confirm a ${reservation.status} reservation` });

    reservation.status = "confirmed";
    res.json({ message: "Reservation confirmed" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// libération d'une place.
app.post("/reservations/:id/release", (req, res) => {
  try {
    const reservation = reservations[req.params.id];
    if (!reservation)
      return res.status(404).json({ error: "Reservation not found" });
    if (reservation.status === "released")
      return res.json({ message: "Reservation already released" });
    if (reservation.status !== "temporary")
      return res
        .status(409)
        .json({ error: `Cannot release a ${reservation.status} reservation` });

    const event = events.find((e) => e.id === reservation.eventId);
    event.disponibility++;
    reservation.status = "released";

    res.json({ message: "Space released" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(3002);
