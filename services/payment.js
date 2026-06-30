import express from "express";

const app = express();
app.use(express.json());

const MAX_AMOUNT = 10000;
const CARD_TEMPLATES = {
  4111111111111111: { balance: 5000, holder: "Test User" },
  5500000000000004: { balance: 15000, holder: "Business User" },
};

app.post("/payment", (req, res) => {
  try {
    const { amount, card } = req.body;

    if (typeof amount !== "number" || amount <= 0) {
      return res
        .status(400)
        .json({ status: "refused", reason: "invalid_amount" });
    }

    if (
      !card ||
      typeof card.number !== "string" ||
      !/^\d{13,19}$/.test(card.number)
    ) {
      return res
        .status(400)
        .json({ status: "refused", reason: "invalid_card" });
    }

    if (amount > MAX_AMOUNT) {
      return res
        .status(402)
        .json({ status: "refused", reason: "amount_exceeds_limit" });
    }

    const cardData = CARD_TEMPLATES[card.number];
    if (!cardData) {
      return res
        .status(402)
        .json({ status: "refused", reason: "card_not_recognized" });
    }

    if (cardData.balance < amount) {
      return res
        .status(402)
        .json({ status: "refused", reason: "insufficient_funds" });
    }

    return res.status(200).json({
      status: "accepted",
      amount,
      card: { last4: card.number.slice(-4) },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(3003);
