const Feedback = require("../model/Feedback");

const router = require("express").Router();

router.get("/", async (req, res) => {
  try {
    const response = await Feedback.find();
    res.send({ lenght: response?.length, data: response });
  } catch (error) {
    res.status(500).send({ message: "Something went wrong!", error: error });
  }
});
router.get("/:email", async (req, res) => {
  try {
    const response = await Feedback.findById({ email: req.params.email });
    res.send({ data: response });
  } catch (error) {
    res.status(500).send({ message: "Something went wrong!", error: error });
  }
});

router.post("/", async (req, res) => {
  const newData = new Feedback(req.body);
  try {
    const response = await newData.save();
    res.send({ message: "Data saved successfully!", data: response });
  } catch (error) {
    res.status(500).send({ message: "Something went wrong!", error: error });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const response = await Feedback.findByIdAndUpdate(req.params.id, req.body);
    res.send({ message: "Data updated successfully!", data: response });
  } catch (error) {
    res.status(500).send({ message: "Something went wrong!", error: error });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const response = await Feedback.findByIdAndDelete(req.params.id);
    res.send({ message: "Data deleted successfully!", data: response });
  } catch (error) {
    res.status(500).send({ message: "Something went wrong!", error: error });
  }
});

module.exports = router;
