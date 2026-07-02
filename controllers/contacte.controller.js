const Contacte = require("../models/Contacte");
const sanitizeHtml = require('sanitize-html');
const cloudinary = require("../utils/cloudinary");

const extractCloudinaryPublicId = (url) => {
  try {
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z]+$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
};

exports.createContact = async (req, res) => {
  const ContactData = req.body;
  if (ContactData.email !== req.user?.email) {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }
  for (const key in ContactData) {
    if (key === 'attachment') continue;
    if (typeof ContactData[key] === 'string') {
      ContactData[key] = sanitizeHtml(ContactData[key]);
    }
  }
  if (ContactData.message) ContactData.message = ContactData.message.substring(0, 500);
  if (ContactData.subject) ContactData.subject = ContactData.subject.substring(0, 100);

  try {
    const count = await Contacte.countDocuments({ email: req.user?.email });
    if (count >= 2) {
      return res.status(400).json({ success: false, message: "Maximum 2 messages allowed" });
    }
    if (ContactData.attachment) {
      try {
        const uploadResult = await cloudinary.uploader.upload(ContactData.attachment, {
          folder: "support_attachments",
          resource_type: "auto"
        });
        ContactData.attachment = uploadResult.secure_url;
      } catch (uploadError) {
        console.error("Cloudinary upload error:", uploadError);
        return res.status(500).json({ message: "Failed to upload attachment", error: uploadError.message });
      }
    }
    const newContact = new Contacte(ContactData);
    const savedContact = await newContact.save();
    res.json(savedContact);
  } catch (error) {
    res.status(500).json({ message: "An error occurred while creating the contact", error });
  }
};

// Get all contacts belonging to the logged-in user
exports.getUserContacts = async (req, res) => {
  const email = req.user?.email;
  if (!email) return res.status(401).json({ message: "Unauthorized" });
  try {
    const contacts = await Contacte.find({ email }).sort({ createdAt: -1 });
    res.json(contacts);
  } catch (error) {
    res.status(500).json({ message: "An error occurred while fetching user contacts", error });
  }
};

// Delete a contact owned by the logged-in user
exports.deleteUserContact = async (req, res) => {
  const email = req.user?.email;
  if (!email) return res.status(401).json({ message: "Unauthorized" });
  try {
    const contact = await Contacte.findById(req.params.id);
    if (!contact) return res.status(404).json({ message: "Contact not found" });
    if (contact.email !== email) return res.status(403).json({ message: "Forbidden" });

    // Delete attachment from Cloudinary if exists
    const toDelete = [];
    if (contact.attachment) {
      const pid = extractCloudinaryPublicId(contact.attachment);
      if (pid) toDelete.push(pid);
    }
    if (contact.adminReplyImage) {
      const pid = extractCloudinaryPublicId(contact.adminReplyImage);
      if (pid) toDelete.push(pid);
    }
    if (toDelete.length > 0) {
      await Promise.allSettled(toDelete.map(pid => cloudinary.uploader.destroy(pid)));
    }

    await Contacte.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Contact deleted" });
  } catch (error) {
    res.status(500).json({ message: "An error occurred while deleting the contact", error });
  }
};

