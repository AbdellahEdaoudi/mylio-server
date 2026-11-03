const mongoose = require('mongoose');
const { Schema, model, models } = mongoose;

const contactSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    messages: [
      {
        sender: {
          type: Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        senderRole: {
          type: String,
          enum: ['user', 'admin'],
          required: true,
        },
        message: {
          type: String,
          required: true,
          trim: true,
          maxlength: 5000,
        },
        imageUrl: {
          type: String,
          default: null,
        },
        isEdited: {
          type: Boolean,
          default: false,
        },
        editedAt: {
          type: Date,
          default: null,
        },
        isDeleted: {
          type: Boolean,
          default: false,
        },
        deletedAt: {
          type: Date,
          default: null,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);

module.exports = models.Contact || model('Contact', contactSchema);
