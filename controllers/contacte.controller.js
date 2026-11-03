const Contacte = require('../models/Contacte');
const User = require('../models/User');
const cloudinary = require('../utils/cloudinary');
const { memoryUpload } = require('../utils/multer');

// Exported for backward-compatibility; preferred usage is importing from utils/multer directly in routes
exports.contactImageMiddleware = memoryUpload.single('image');

// Sanitize text input: strips script tags and HTML tags while preserving user text characters
const cleanText = (value) =>
  String(value || '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();

// Extract public_id directly from a Cloudinary URL
const getPublicIdFromUrl = (url) => {
  if (!url || typeof url !== 'string' || !url.includes('cloudinary.com')) return null;
  try {
    const pathname = new URL(url).pathname;
    const parts = pathname.split('/');
    const uploadIdx = parts.indexOf('upload');
    if (uploadIdx === -1) return null;
    const fileParts = parts.slice(uploadIdx + 1);
    const versionIdx = fileParts.findIndex((p) => /^v\d+$/.test(p));
    if (versionIdx !== -1) {
      return fileParts.slice(versionIdx + 1).join('/').replace(/\.[^/.]+$/, '');
    }
    return fileParts.join('/').replace(/\.[^/.]+$/, '');
  } catch {
    return null;
  }
};

// Upload base64 or buffer
const resolveImageUpload = async (req) => {
  if (req.file) {
    return await cloudinary.uploadImageBuffer(req.file.buffer, 'MessagesImage');
  }
  const base64 = req.body.attachment || req.body.image;
  if (base64 && typeof base64 === 'string' && base64.startsWith('data:image')) {
    return await cloudinary.uploader.upload(base64, {
      folder: 'MessagesImage',
      transformation: [
        { width: 1200, height: 1200, crop: 'limit', quality: 'auto', fetch_format: 'auto' },
      ],
    });
  }
  return null;
};

// 1. Get current user's contacts
exports.getUserContacts = async (req, res) => {
  try {
    const contacts = await Contacte.find({ user: req.user.id })
      .populate('user', 'fullname username email urlimage')
      .populate('messages.sender', 'fullname username email urlimage role')
      .sort({ updatedAt: -1 })
      .lean();

    return res.json(contacts);
  } catch (error) {
    console.error('[Get User Contacts Error]:', error);
    return res.status(500).json({
      message: 'Failed to load your messages',
    });
  }
};

// 2. Create a new contact inquiry
exports.createContact = async (req, res) => {
  let uploadedPublicId = null;

  try {
    const user = await User.findById(req.user?.id);
    if (!user) {
      return res.status(403).json({
        message: 'Only registered users can send contact messages.',
      });
    }

    const subject = cleanText(req.body.subject);
    const message = cleanText(req.body.message);

    if (!subject || subject.length > 200) {
      return res.status(400).json({
        message: 'Subject is required and must not exceed 200 characters.',
      });
    }

    if (!message || message.length > 5000) {
      return res.status(400).json({
        message: 'Message is required and must not exceed 5000 characters.',
      });
    }

    let imageUrl = null;
    const uploaded = await resolveImageUpload(req);
    if (uploaded) {
      imageUrl = uploaded.secure_url;
      uploadedPublicId = uploaded.public_id;
    }

    const contact = await Contacte.create({
      user: user._id,
      subject,
      messages: [
        {
          sender: user._id,
          senderRole: 'user',
          message,
          ...(imageUrl && { imageUrl }),
        },
      ],
    });

    uploadedPublicId = null;

    await contact.populate([
      { path: 'user', select: 'fullname username email urlimage' },
      { path: 'messages.sender', select: 'fullname username email urlimage role' },
    ]);

    return res.status(201).json({
      message: 'Contact sent successfully',
      contact,
    });
  } catch (error) {
    if (uploadedPublicId) {
      try {
        await cloudinary.uploader.destroy(uploadedPublicId);
      } catch (cleanupError) {
        console.error('Image cleanup failed:', cleanupError);
      }
    }

    console.error('[Create Contact Error]:', error);
    return res.status(500).json({
      message: 'Failed to create contact',
    });
  }
};

// 3. Add reply to contact conversation
exports.addReply = async (req, res) => {
  let uploadedPublicId = null;

  try {
    const contact = await Contacte.findById(req.params.id);

    if (!contact) {
      return res.status(404).json({
        message: 'Contact not found',
      });
    }

    if (contact.user.toString() !== req.user?.id?.toString()) {
      return res.status(403).json({
        message: 'You can only reply to your own conversations.',
      });
    }

    // Guard: User can only reply after the support team (admin) has responded
    const messages = contact.messages || [];
    const hasAdminReplied = messages.some((m) => m.senderRole === 'admin' && !m.isDeleted);
    const lastMsg = messages[messages.length - 1];

    if (!hasAdminReplied || (lastMsg && lastMsg.senderRole === 'user')) {
      return res.status(400).json({
        message: 'You cannot reply until the support team has responded to your message.',
      });
    }

    const message = cleanText(req.body.message || '');

    let imageUrl = null;
    const uploaded = await resolveImageUpload(req);
    if (uploaded) {
      imageUrl = uploaded.secure_url;
      uploadedPublicId = uploaded.public_id;
    }

    if (!message && !imageUrl) {
      return res.status(400).json({
        message: 'Message or image is required.',
      });
    }

    if (message.length > 5000) {
      return res.status(400).json({
        message: 'Message must not exceed 5000 characters.',
      });
    }

    contact.messages.push({
      sender: req.user.id,
      senderRole: 'user',
      message: message || ' ',
      ...(imageUrl && { imageUrl }),
    });

    await contact.save();
    uploadedPublicId = null;

    await contact.populate([
      { path: 'user', select: 'fullname username email urlimage' },
      { path: 'messages.sender', select: 'fullname username email urlimage role' },
    ]);

    return res.json({
      message: 'Reply sent successfully',
      contact,
    });
  } catch (error) {
    if (uploadedPublicId) {
      try {
        await cloudinary.uploader.destroy(uploadedPublicId);
      } catch (cleanupError) {
        console.error('Image cleanup failed:', cleanupError);
      }
    }

    console.error('[Add Reply Error]:', error);
    return res.status(500).json({
      message: 'Failed to send reply',
    });
  }
};

// 4. Update specific reply
exports.updateReply = async (req, res) => {
  let uploadedPublicId = null;

  try {
    const { id, messageId } = req.params;
    const contact = await Contacte.findById(id);

    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    if (contact.user.toString() !== req.user?.id?.toString()) {
      return res.status(403).json({ message: 'You can only edit your own conversations.' });
    }

    const msg = contact.messages.id(messageId);
    if (!msg) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (msg.senderRole !== 'user' || msg.sender.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: 'You can only edit your own messages.' });
    }

    if (msg.isDeleted) {
      return res.status(400).json({ message: 'Cannot edit a deleted message.' });
    }

    if (req.body.message !== undefined) {
      const text = cleanText(req.body.message);
      if (!text || text.length > 5000) {
        return res.status(400).json({ message: 'Message text is required (max 5000 characters).' });
      }
      msg.message = text;
    }

    const uploaded = await resolveImageUpload(req);
    if (uploaded) {
      if (msg.imageUrl) {
        const oldPublicId = getPublicIdFromUrl(msg.imageUrl);
        if (oldPublicId) {
          try {
            await cloudinary.uploader.destroy(oldPublicId);
          } catch (delErr) {
            console.error('Failed to destroy old Cloudinary image:', delErr?.message || delErr);
          }
        }
      }
      uploadedPublicId = uploaded.public_id;
      msg.imageUrl = uploaded.secure_url;
      uploadedPublicId = null;
    } else if (req.body.removeImage === 'true' || req.body.removeImage === true) {
      if (msg.imageUrl) {
        const oldPublicId = getPublicIdFromUrl(msg.imageUrl);
        if (oldPublicId) {
          try {
            await cloudinary.uploader.destroy(oldPublicId);
          } catch (delErr) {
            console.error('Failed to destroy Cloudinary image on removal:', delErr?.message || delErr);
          }
        }
        msg.imageUrl = null;
      }
    }

    msg.isEdited = true;
    msg.editedAt = new Date();

    await contact.save();

    await contact.populate([
      { path: 'user', select: 'fullname username email urlimage' },
      { path: 'messages.sender', select: 'fullname username email urlimage role' },
    ]);

    return res.json({
      message: 'Message updated successfully',
      contact,
    });
  } catch (error) {
    if (uploadedPublicId) {
      try {
        await cloudinary.uploader.destroy(uploadedPublicId);
      } catch (cleanupError) {
        console.error('Image cleanup failed:', cleanupError);
      }
    }
    console.error('[Update Message Error]:', error);
    return res.status(500).json({ message: 'Failed to update message' });
  }
};

// 5. Delete specific reply (WhatsApp style soft-delete + Cloudinary image deletion)
exports.deleteReply = async (req, res) => {
  try {
    const { id, messageId } = req.params;
    const contact = await Contacte.findById(id);

    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    if (contact.user.toString() !== req.user?.id?.toString()) {
      return res.status(403).json({ message: 'You can only delete your own messages.' });
    }

    const msg = contact.messages.id(messageId);
    if (!msg) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (msg.senderRole !== 'user' || msg.sender.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: 'You can only delete your own messages.' });
    }

    if (msg.isDeleted) {
      return res.status(400).json({ message: 'Message is already deleted.' });
    }

    if (msg.imageUrl) {
      const publicId = getPublicIdFromUrl(msg.imageUrl);
      if (publicId) {
        try {
          await cloudinary.uploader.destroy(publicId);
        } catch (delErr) {
          console.error('Failed to destroy Cloudinary image for deleted message:', delErr?.message || delErr);
        }
      }
      msg.imageUrl = null;
    }

    msg.isDeleted = true;
    msg.deletedAt = new Date();
    msg.message = 'This message was deleted';

    await contact.save();

    await contact.populate([
      { path: 'user', select: 'fullname username email urlimage' },
      { path: 'messages.sender', select: 'fullname username email urlimage role' },
    ]);

    return res.json({
      message: 'Message deleted successfully',
      contact,
    });
  } catch (error) {
    console.error('[Delete Message Error]:', error);
    return res.status(500).json({ message: 'Failed to delete message' });
  }
};

// 6. Delete entire contact inquiry & delete all attached images from Cloudinary
exports.deleteContactById = async (req, res) => {
  try {
    const contact = await Contacte.findById(req.params.id);

    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    if (contact.user.toString() !== req.user?.id?.toString()) {
      return res.status(403).json({ message: 'You can only delete your own conversations.' });
    }

    const imageUrls = (contact.messages || [])
      .map((msg) => msg.imageUrl)
      .filter(Boolean);

    for (const url of imageUrls) {
      const publicId = getPublicIdFromUrl(url);
      if (publicId) {
        try {
          await cloudinary.uploader.destroy(publicId);
        } catch (err) {
          console.error('Failed to destroy Cloudinary image during contact delete:', err?.message || err);
        }
      }
    }

    await Contacte.findByIdAndDelete(contact._id);

    return res.json({
      success: true,
      message: 'Conversation and all associated attachments deleted successfully',
      id: contact._id,
    });
  } catch (error) {
    console.error('[Delete Contact Error]:', error);
    return res.status(500).json({ message: 'Failed to delete contact' });
  }
};
