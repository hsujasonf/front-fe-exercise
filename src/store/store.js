export class Store {
  constructor() {
    this.conversations = {};
    this.processedEvents = new Set();
    this.eventTypes = {
      MESSAGE_RECEIVED: 'messageReceived',
      ASSIGNED: 'assigned',
      UNASSIGNED: 'unassigned',
      TYPING_STARTED: 'typingStarted',
      TYPING_STOPPED: 'typingStopped',
    };
    this.errorMessages = {
      INVALID_CONVERSATION_ID: 'Invalid conversationId: conversationId cannot be null or undefined.',
      INVALID_USER: 'Invalid user: user cannot be null or undefined in an assigned event.',
      ERROR_GETTING_CONVERSATIONS: 'Error getting conversations:',
      ERROR_GENERATING_BLURB: 'Error generating blurb for conversation ',
      ERROR_HANDLING_NEW_CONVERSATION: 'Error handling new conversation:',
      ERROR_HANDLING_MESSAGE_RECEIVED: 'Error handling message received:',
      ERROR_HANDLING_ASSIGNED: 'Error handling assigned event:',
      ERROR_HANDLING_UNASSIGNED: 'Error handling unassigned event:',
      ERROR_HANDLING_TYPING_STARTED: 'Error handling typing started event:',
      ERROR_HANDLING_TYPING_STOPPED: 'Error handling typing stopped event:',
      ERROR_HANDLING_EVENT: 'Error handling event:',
      UNEXPECTED_TYPE_WARNING: 'Unexpected event type:',
    };
  }

  getConversations() {
    try {
      // filter out conversations with John_Doe as the assigned_user
      const conversationsArray = [];
      for (const [id, data] of Object.entries(this.conversations)) {
        if (data.assignedUser !== 'John_Doe') {
          // store typingUsers and mostRecentMessage but do not display in the conversations array.
          const { typingUsers, mostRecentMessage, ...rest } = data;

          conversationsArray.push({
            id,
            ...rest,
          });
        }
      }

      conversationsArray.sort((a, b) => b.lastUpdatedTimestamp - a.lastUpdatedTimestamp);
      return conversationsArray;
    } catch (error) {
      console.error(this.errorMessages.ERROR_GETTING_CONVERSATIONS, error);
      return [];
    }
  }

  generateBlurb(conversationId, body = '') {
    // generateBlurb generates the first 256 characters of last message or if there are typing users, shows who is typing.
    try {
      const currentConversation = this.conversations[conversationId];
      const typingUsers = Array.from(currentConversation.typingUsers);

      if (!typingUsers.length && body) {
        currentConversation.blurb = body.slice(0, 256);
      } else if (typingUsers.length === 1) {
        currentConversation.blurb = `${typingUsers[0]} is replying...`;
      } else if (typingUsers.length > 1) {
        currentConversation.blurb = `${typingUsers.join(', ')} are replying...`;
      } else {
        currentConversation.blurb = currentConversation.mostRecentMessage.slice(0, 256) || '';
      }
    } catch (error) {
      console.error(`${this.errorMessages.ERROR_GENERATING_BLURB} ${conversationId}:`, error);
    }
  }

  getEventIdentifier(event) {
    // store event indentifier in processed events to check if there is a duplicate event.
    const {
      type,
      data: { user, timestamp, conversationId, subject },
    } = event;
    return `${timestamp}-${conversationId}-${type}-${user || ''}-${subject || ''}`;
  }

  handleNewConversation(event) {
    try {
      const {
        data: { conversationId, user, subject },
      } = event;

      this.conversations[conversationId] = {
        assignedUser: user || null,
        subject,
        lastUpdatedTimestamp: 0,
        messageCount: 0,
        typingUsers: new Set(),
      };
    } catch (error) {
      console.error(this.errorMessages.ERROR_HANDLING_NEW_CONVERSATION, error);
    }
  }

  handleMessageReceived(event) {
    try {
      const {
        data: { conversationId, subject, body },
      } = event;
      const currentConversation = this.conversations[conversationId];
      currentConversation.messageCount++;
      currentConversation.subject = subject;
      // keep track of the most recent message to generate blurb in case users stop typing
      currentConversation.mostRecentMessage = body.slice(0, 256);
      if (!currentConversation.typingUsers.size) this.generateBlurb(conversationId, body);
    } catch (error) {
      console.error(this.errorMessages.ERROR_HANDLING_MESSAGE_RECEIVED, error);
    }
  }

  handleAssigned(conversation, data) {
    try {
      const { user } = data;
      if (!user) {
        throw new Error(this.errorMessages.INVALID_USER);
      }
      conversation.assignedUser = user;
    } catch (error) {
      console.error(this.errorMessages.ERROR_HANDLING_ASSIGNED, error);
    }
  }

  handleUnassigned(conversation) {
    try {
      conversation.assignedUser = null;
    } catch (error) {
      console.error(this.errorMessages.ERROR_HANDLING_UNASSIGNED, error);
    }
  }

  handleTypingStarted(conversation, data) {
    try {
      const { user, conversationId } = data;
      if (!user) {
        throw new Error(this.errorMessages.INVALID_USER);
      }
      conversation.typingUsers.add(user);

      // blurb should be updated when there are additional typing users
      this.generateBlurb(conversationId);
    } catch (error) {
      console.error(this.errorMessages.ERROR_HANDLING_TYPING_STARTED, error);
    }
  }

  handleTypingStopped(conversation, data) {
    try {
      const { user, conversationId } = data;
      conversation.typingUsers.delete(user);

      // update blurb when a user has stopped typing
      this.generateBlurb(conversationId);
    } catch (error) {
      console.error(this.errorMessages.ERROR_HANDLING_TYPING_STOPPED, error);
    }
  }

  handleEvent(event) {
    try {
      const { type, data } = event;
      const { timestamp, conversationId } = data;

      // Throw error if conversationId is null or undefined
      if (!conversationId) {
        throw new Error(this.errorMessages.INVALID_CONVERSATION_ID);
      }

      const eventIdentifier = this.getEventIdentifier(event);

      // Skip duplicate events
      if (this.processedEvents.has(eventIdentifier)) {
        return;
      }

      // if conversation doesn't exist, create a new conversation
      if (!this.conversations[conversationId]) {
        this.handleNewConversation(event);
      }

      let currentConversation = this.conversations[conversationId];

      // update the conversation based on event type
      switch (type) {
        case this.eventTypes.MESSAGE_RECEIVED:
          this.handleMessageReceived(event);
          break;
        case this.eventTypes.TYPING_STARTED:
          this.handleTypingStarted(currentConversation, data);
          break;
        case this.eventTypes.TYPING_STOPPED:
          this.handleTypingStopped(currentConversation, data);
          break;
        case this.eventTypes.ASSIGNED:
          this.handleAssigned(currentConversation, data);
          break;
        case this.eventTypes.UNASSIGNED:
          this.handleUnassigned(currentConversation, data);
          break;
        default:
          // handle unexpected event type
          console.warn(`${this.errorMessages.UNEXPECTED_TYPE_WARNING} ${type}`);
          break;
      }

      // keep track of processed events in case we receive the same exact event multiple times.
      this.processedEvents.add(eventIdentifier);

      // update timestamp based on most recent event
      currentConversation.lastUpdatedTimestamp = Math.max(
        currentConversation.lastUpdatedTimestamp,
        timestamp
      );
    } catch (error) {
      console.error(this.errorMessages.ERROR_HANDLING_EVENT, error);
    }
  }
}
