// controller/admin.controller.js
const User = require("../models/User");
const Contacte = require("../models/Contacte");
const Payment = require("../models/Payment");

const cloudinary = require("../utils/cloudinary");

const extractCloudinaryPublicId = (url) => {
  if (!url || typeof url !== "string" || !url.includes("cloudinary.com")) return null;
  // Guard: Never delete the shared default avatar
  if (url.includes("dgmlr4uuim5swutkp6a8")) return null;
  try {
    const pathname = new URL(url).pathname;
    const parts = pathname.split("/");
    const uploadIdx = parts.indexOf("upload");
    if (uploadIdx === -1) return null;
    const fileParts = parts.slice(uploadIdx + 1);
    const versionIdx = fileParts.findIndex((p) => /^v\d+$/.test(p));
    if (versionIdx !== -1) {
      return fileParts.slice(versionIdx + 1).join("/").replace(/\.[^/.]+$/, "");
    }
    return fileParts.join("/").replace(/\.[^/.]+$/, "");
  } catch {
    try {
      const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z]+$/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }
};

const destroyCloudinaryAsset = async (publicIdOrUrl) => {
  if (!publicIdOrUrl) return;
  const publicId =
    typeof publicIdOrUrl === "string" && publicIdOrUrl.includes("cloudinary.com")
      ? extractCloudinaryPublicId(publicIdOrUrl)
      : publicIdOrUrl;
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error("Cloudinary destroy failed:", err?.message || err);
  }
};

const cleanText = (value) =>
  String(value || "")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .trim();

const collectContactImageIds = (contactDoc) => {
  const ids = [];
  if (contactDoc?.imageUrl) {
    const pid = extractCloudinaryPublicId(contactDoc.imageUrl);
    if (pid) ids.push(pid);
  }
  if (contactDoc?.attachment) {
    const pid = extractCloudinaryPublicId(contactDoc.attachment);
    if (pid) ids.push(pid);
  }
  if (contactDoc?.adminReplyImage) {
    const pid = extractCloudinaryPublicId(contactDoc.adminReplyImage);
    if (pid) ids.push(pid);
  }
  (contactDoc?.messages || []).forEach((m) => {
    if (m.imageUrl) {
      const pid = extractCloudinaryPublicId(m.imageUrl);
      if (pid) ids.push(pid);
    }
  });
  return [...new Set(ids.filter(Boolean))];
};

const resolveAdminImageUpload = async (req) => {
  if (req.file) {
    return await cloudinary.uploadImageBuffer(req.file.buffer, "MessagesImage");
  }
  const base64 = req.body.replyImageBase64 || req.body.attachment || req.body.image;
  if (base64 && typeof base64 === "string" && base64.startsWith("data:image")) {
    return await cloudinary.uploader.upload(base64, {
      folder: "MessagesImage",
      transformation: [
        { width: 1200, height: 1200, crop: "limit", quality: "auto", fetch_format: "auto" },
      ],
    });
  }
  return null;
};

const isAdminUser = (user) => {
  if (!user) return false;
  return user.role === "admin";
};

exports.GetDataApp = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    const [users, contacts, payment] = await Promise.all([
      User.find()
        .collation({ locale: "en", strength: 1 })
        .sort({ fullname: 1 })
        .select("about fullname email username role location category createdAt urlimage theme")
        .lean(),
      Contacte.find()
        .populate("user", "fullname username email urlimage role phoneNumber location")
        .populate("messages.sender", "fullname username email urlimage role phoneNumber")
        .sort({ updatedAt: -1 })
        .select("-__v")
        .lean(),
      Payment.find()
        .populate("user", "fullname username email urlimage")
        .select("-__v")
        .lean(),
    ]);
    res.status(200).json({
      success: true,
      users,
      contacts,
      payment,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getAllContacts = async (req, res) => {
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  try {
    const contacts = await Contacte.find()
      .populate("user", "fullname username email urlimage role phoneNumber location")
      .populate("messages.sender", "fullname username email urlimage role phoneNumber")
      .sort({ updatedAt: -1 });

    res.json(contacts);
  } catch (error) {
    console.error("[Admin Get Contacts Error]:", error);
    res.status(500).json({ message: "Failed to fetch contact inquiries" });
  }
};

// Delete user by ID
exports.deleteUserById = async (req, res) => {
  const { id } = req.params;
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  try {
    const userToDelete = await User.findById(id).lean();
    if (!userToDelete) {
      return res.status(404).json({ message: "User not found" });
    }

    // ── Collect all Cloudinary public_ids to delete ──
    const publicIds = [];

    // 1. Profile image
    if (userToDelete.urlimage) {
      const pid = extractCloudinaryPublicId(userToDelete.urlimage);
      if (pid) publicIds.push(pid);
    }

    // 2. Project images
    if (Array.isArray(userToDelete.projects)) {
      for (const project of userToDelete.projects) {
        if (project.image) {
          const pid = extractCloudinaryPublicId(project.image);
          if (pid) publicIds.push(pid);
        }
      }
    }

    // 3. Certificate images
    if (Array.isArray(userToDelete.certificates)) {
      for (const cert of userToDelete.certificates) {
        if (cert.cfimage) {
          const pid = extractCloudinaryPublicId(cert.cfimage);
          if (pid) publicIds.push(pid);
        }
      }
    }

    // 4. Contact conversation images
    const userContacts = await Contacte.find({ user: id }).lean();
    for (const contact of userContacts) {
      collectContactImageIds(contact).forEach((pid) => publicIds.push(pid));
    }

    // 5. Delete all images from Cloudinary in parallel (don't block on errors)
    if (publicIds.length > 0) {
      await Promise.allSettled(
        publicIds.map((pid) => cloudinary.uploader.destroy(pid))
      );
    }

    // 6. Delete user + related DB records
    await User.findByIdAndDelete(id);
    await Contacte.deleteMany({ user: id });
    await Payment.deleteMany({ user: id });

    res.json({ message: "User and all associated data deleted successfully" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.deleteContactById = async (req, res) => {
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  try {
    const contact = await Contacte.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({ message: "Contact not found" });
    }

    const imageIds = collectContactImageIds(contact);
    for (const pid of imageIds) {
      await destroyCloudinaryAsset(pid);
    }

    const deletedContact = await Contacte.findByIdAndDelete(req.params.id);
    if (deletedContact && deletedContact.user) {
      await User.updateOne(
        { _id: deletedContact.user },
        { $currentDate: { updatedAt: true } }
      );
    }
    res.json({ message: "Contact conversation and all attachments deleted successfully", deletedContact });
  } catch (error) {
    res.status(500).json({ message: "An error occurred while deleting the contact", error });
  }
};

// Get Cloudinary Images (and Folders)
exports.getCloudinaryImages = async (req, res) => {
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  try {
    const { next_cursor, folder } = req.query;

    let folders = [];
    let resources = [];
    let next_cursor_res = null;

    // Fetch Folders (only on first page load of a directory view)
    if (!next_cursor || next_cursor === 'undefined' || next_cursor === 'null') {
      try {
        if (folder) {
          // Get subfolders of a specific folder
          const foldersRes = await cloudinary.api.sub_folders(folder);
          folders = foldersRes.folders;
        } else {
          // Get root folders
          const rootFolders = await cloudinary.api.root_folders();
          folders = rootFolders.folders;
        }
      } catch (err) {
        console.error("Folder fetch error:", err.message);
        // Non-critical, continue to fetch resources
      }
    }

    // Fetch Resources
    const options = {
      type: 'upload',
      max_results: 50,
      prefix: folder ? folder + "/" : undefined // Filter by folder
    };

    if (next_cursor && next_cursor !== 'null' && next_cursor !== 'undefined') {
      options.next_cursor = next_cursor;
    }

    // console.log("Fetching cloudinary images with options:", options);

    const result = await cloudinary.api.resources(options);
    resources = result.resources;
    next_cursor_res = result.next_cursor;

    res.json({
      folders,
      resources,
      next_cursor: next_cursor_res
    });

  } catch (error) {
    console.error("Cloudinary API Error:", error);
    res.status(500).json({
      message: "Error fetching Cloudinary images",
      error: error.message || error
    });
  }
};

// Delete Cloudinary Image
exports.deleteCloudinaryImage = async (req, res) => {
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  try {
    const { public_id } = req.body;

    if (!public_id) {
      return res.status(400).json({ message: "Public ID is required" });
    }

    const result = await cloudinary.uploader.destroy(public_id);

    if (result.result === 'ok') {
      res.json({ message: "Image deleted successfully", public_id });
    } else {
      res.status(400).json({ message: "Failed to delete image", result });
    }

  } catch (error) {
    console.error("Cloudinary Delete Error:", error);
    res.status(500).json({
      message: "Error deleting Cloudinary image",
      error: error.message || error
    });
  }
};

// Reply to a user's contact conversation
exports.replyToContact = async (req, res) => {
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ message: "Forbidden" });
  }

  let uploadedPublicId = null;

  try {
    const { id } = req.params;
    const contact = await Contacte.findById(id);
    if (!contact) {
      return res.status(404).json({ message: "Contact message not found" });
    }

    const rawText = req.body.message !== undefined ? req.body.message : req.body.reply;
    const message = cleanText(rawText);

    let imageUrl = null;
    const uploaded = await resolveAdminImageUpload(req);
    if (uploaded) {
      imageUrl = uploaded.secure_url;
      uploadedPublicId = uploaded.public_id;
    }

    if (!message && !imageUrl) {
      return res.status(400).json({ message: "Reply message or image is required." });
    }

    if (message.length > 5000) {
      return res.status(400).json({ message: "Reply message must not exceed 5000 characters." });
    }

    contact.messages.push({
      senderRole: "admin",
      sender: req.user.id,
      message: message || " ",
      ...(imageUrl && { imageUrl }),
    });

    await contact.save();
    uploadedPublicId = null;

    await contact.populate([
      { path: "user", select: "fullname username email urlimage role phoneNumber location" },
      { path: "messages.sender", select: "fullname username email urlimage role phoneNumber" },
    ]);

    res.json({ message: "Reply sent successfully", contact });
  } catch (error) {
    if (uploadedPublicId) {
      try {
        await destroyCloudinaryAsset(uploadedPublicId);
      } catch (cleanErr) {
        console.error("Image cleanup failed:", cleanErr);
      }
    }
    console.error("[Admin Reply Contact Error]:", error);
    res.status(500).json({ message: "Failed to send reply", error: error.message });
  }
};

// Admin edits a reply in a contact conversation
exports.updateReply = async (req, res) => {
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ message: "Forbidden" });
  }

  let uploadedPublicId = null;

  try {
    const { id, messageId } = req.params;
    const contact = await Contacte.findById(id);

    if (!contact) {
      return res.status(404).json({ message: "Contact not found" });
    }

    const msg = contact.messages.id(messageId);
    if (!msg) {
      return res.status(404).json({ message: "Reply not found" });
    }

    if (msg.isDeleted) {
      return res.status(400).json({ message: "Cannot edit a deleted reply." });
    }

    const rawText = req.body.message !== undefined ? req.body.message : req.body.reply;
    if (rawText !== undefined) {
      const text = cleanText(rawText);
      if (!text || text.length > 5000) {
        return res.status(400).json({ message: "Reply text is required (max 5000 characters)." });
      }
      msg.message = text;
    }

    const uploaded = await resolveAdminImageUpload(req);
    if (uploaded) {
      if (msg.imageUrl) {
        await destroyCloudinaryAsset(msg.imageUrl);
      }
      uploadedPublicId = uploaded.public_id;
      msg.imageUrl = uploaded.secure_url;
      uploadedPublicId = null;
    } else if (
      req.body.removeImage === "true" ||
      req.body.removeImage === true ||
      req.body.replyImageBase64 === null
    ) {
      if (msg.imageUrl) {
        await destroyCloudinaryAsset(msg.imageUrl);
        msg.imageUrl = null;
      }
    }

    msg.isEdited = true;
    msg.editedAt = new Date();

    await contact.save();

    await contact.populate([
      { path: "user", select: "fullname username email urlimage role phoneNumber location" },
      { path: "messages.sender", select: "fullname username email urlimage role phoneNumber" },
    ]);

    res.json({ message: "Reply updated successfully", contact });
  } catch (error) {
    if (uploadedPublicId) {
      try {
        await destroyCloudinaryAsset(uploadedPublicId);
      } catch (cleanErr) {
        console.error("Image cleanup failed:", cleanErr);
      }
    }
    console.error("[Admin Update Reply Error]:", error);
    res.status(500).json({ message: "Failed to update reply" });
  }
};

// Admin deletes a specific reply (WhatsApp style soft-delete + Cloudinary image deletion)
exports.deleteReply = async (req, res) => {
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ message: "Forbidden" });
  }

  try {
    const { id, messageId } = req.params;
    const contact = await Contacte.findById(id);

    if (!contact) {
      return res.status(404).json({ message: "Contact not found" });
    }

    const msg = contact.messages.id(messageId);
    if (!msg) {
      return res.status(404).json({ message: "Reply not found" });
    }

    if (msg.isDeleted) {
      return res.status(400).json({ message: "Reply is already deleted." });
    }

    if (msg.imageUrl) {
      await destroyCloudinaryAsset(msg.imageUrl);
      msg.imageUrl = null;
    }

    msg.isDeleted = true;
    msg.deletedAt = new Date();
    msg.message = "This message was deleted";

    await contact.save();

    await contact.populate([
      { path: "user", select: "fullname username email urlimage role phoneNumber location" },
      { path: "messages.sender", select: "fullname username email urlimage role phoneNumber" },
    ]);

    res.json({ message: "Reply deleted successfully", contact });
  } catch (error) {
    console.error("[Admin Delete Reply Error]:", error);
    res.status(500).json({ message: "Failed to delete reply" });
  }
};

// Manually create payment for a user (admin action)
exports.createPaymentManually = async (req, res) => {
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const { username, userId } = req.body;
  const identifier = (username || "").trim().toLowerCase();
  if (!identifier && !userId) {
    return res.status(400).json({ message: "Username is required" });
  }

  try {
    const targetUser = userId
      ? await User.findById(userId)
      : await User.findOne({ username: identifier });

    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    let payment = await Payment.findOne({ user: targetUser._id });
    if (payment) {
      payment.status = "ACTIVE";
      await payment.save();
      await payment.populate("user", "fullname username email urlimage");
      return res.json({ message: "Payment updated to ACTIVE", payment });
    }
    payment = await Payment.create({
      user: targetUser._id,
      status: "ACTIVE",
      paypalOrderId: `ADMIN-GRANT-${Date.now()}`,
      amount: 0
    });
    await payment.populate("user", "fullname username email urlimage");
    res.status(201).json({ message: "Payment created successfully", payment });
  } catch (error) {
    console.error("Error creating payment:", error);
    res.status(500).json({ message: "Failed to create payment", error: error.message });
  }
};

exports.deletePaymentById = async (req, res) => {
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const { id } = req.params;
  try {
    const payment = await Payment.findByIdAndDelete(id);
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }
    res.json({ message: "Payment deleted successfully" });
  } catch (error) {
    console.error("Error deleting payment:", error);
    res.status(500).json({ message: "Failed to delete payment", error: error.message });
  }
};

exports.updatePaymentStatus = async (req, res) => {
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const { id } = req.params;
  try {
    const payment = await Payment.findById(id);
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    payment.status = payment.status === "ACTIVE" ? "REFUNDED" : "ACTIVE";
    await payment.save();
    await payment.populate("user", "fullname username email urlimage");

    res.json({ message: "Payment status updated successfully", payment });
  } catch (error) {
    console.error("Error updating payment:", error);
    res.status(500).json({ message: "Failed to update payment", error: error.message });
  }
};