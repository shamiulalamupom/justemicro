import express from "express";
import { randomUUID } from "crypto";

const app = express();
app.use(express.json());

const USER_SERVICE_URL =
  process.env.USER_SERVICE_URL || "http://localhost:3001";
const INVENTORY_SERVICE_URL =
  process.env.INVENTORY_SERVICE_URL || "http://localhost:3002";
const PAYMENT_SERVICE_URL =
  process.env.PAYMENT_SERVICE_URL || "http://localhost:3003";

const bookings = new Map();

app.post("/bookings", async (req, res) => {
  try {
    const { userId, seatId, amount, paymentMethod } = req.body;
    if (!userId || !seatId || !amount || !paymentMethod) {
      return res.status(400).json({
        error: "userId, seatId, amount and paymentMethod are required",
      });
    }

    const now = new Date().toISOString();
    const booking = {
      id: randomUUID(),
      userId,
      seatId,
      amount,
      paymentMethod,
      status: "pending",
      createdAt: now,
      updatedAt: now,
      details: {},
    };
    bookings.set(booking.id, booking);

    // verify the user exists
    const userRes = await fetch(
      `${USER_SERVICE_URL}/users/${encodeURIComponent(userId)}`,
    );
    if (!userRes.ok) {
      booking.status = "canceled";
      booking.updatedAt = new Date().toISOString();
      booking.details = { reason: "user_not_found" };
      return res.status(404).json({
        id: booking.id,
        status: booking.status,
        error: "User does not exist",
      });
    }

    // reserve the seat (inventory keys reservations off an event id)
    let reservation;
    try {
      const reserveRes = await fetch(
        `${INVENTORY_SERVICE_URL}/events/${encodeURIComponent(seatId)}/reserve-temp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );
      if (!reserveRes.ok) throw new Error(`status ${reserveRes.status}`);
      reservation = await reserveRes.json();
      booking.status = "pending";
      booking.updatedAt = new Date().toISOString();
      booking.details = { reservationId: reservation.reservationId };
    } catch (error) {
      booking.status = "seat_unavailable";
      booking.updatedAt = new Date().toISOString();
      booking.details = {
        reason: "seat_unavailable",
        error: error.message,
      };
      return res.status(409).json({
        id: booking.id,
        status: booking.status,
        error: "Seat unavailable",
      });
    }

    // release the temporary seat
    const release = async () => {
      try {
        const releaseRes = await fetch(
          `${INVENTORY_SERVICE_URL}/reservations/${encodeURIComponent(reservation.reservationId)}/release`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          },
        );
        if (!releaseRes.ok) throw new Error(`status ${releaseRes.status}`);
        return true;
      } catch (error) {
        console.error(
          `Failed to release reservation ${reservation.reservationId} for booking ${booking.id}:`,
          error.message,
        );
        booking.details.releaseFailed = true;
        return false;
      }
    };

    // request payment (payment service expects { amount, card: { number } })
    let payment;
    try {
      const payRes = await fetch(`${PAYMENT_SERVICE_URL}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          card: paymentMethod,
        }),
      });
      // A refused payment is a 4xx but still a valid response body to inspect.
      payment = await payRes.json();
    } catch (error) {
      booking.status = "payment_failed";
      booking.updatedAt = new Date().toISOString();
      booking.details = {
        reason: "payment_service_error",
        error: error.message,
      };
      await release();
      return res.status(502).json({
        id: booking.id,
        status: booking.status,
        error: "Payment processing failed",
      });
    }

    if (payment.status !== "accepted") {
      booking.status = "payment_failed";
      booking.updatedAt = new Date().toISOString();
      booking.details = { reason: "payment_refused", payment };
      await release();
      return res.status(402).json({
        id: booking.id,
        status: booking.status,
        error: "Payment refused",
      });
    }

    // confirm the seat
    try {
      const confirmRes = await fetch(
        `${INVENTORY_SERVICE_URL}/reservations/${encodeURIComponent(reservation.reservationId)}/confirm`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );
      if (!confirmRes.ok) throw new Error(`status ${confirmRes.status}`);
      booking.status = "confirmed";
      booking.updatedAt = new Date().toISOString();
      booking.details = {
        reservationId: reservation.reservationId,
        paidAmount: payment.amount,
        card: payment.card,
      };
      return res.status(201).json({ id: booking.id, status: booking.status });
    } catch (error) {
      booking.status = "payment_failed";
      booking.updatedAt = new Date().toISOString();
      booking.details = { reason: "confirm_failed", error: error.message };
      await release();
      return res.status(500).json({
        id: booking.id,
        status: booking.status,
        error: "Unable to confirm booking",
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/bookings/:id", (req, res) => {
  try {
    const booking = bookings.get(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }
    res.json(booking);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(3004);
