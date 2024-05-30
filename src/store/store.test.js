import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Store } from './store';

describe('Store', () => {
  let store;

  beforeEach(() => {
    store = new Store();
  });

  describe('getConversations', () => {
    it('should return conversations in reverse chronological order excluding those assigned to John_Doe', () => {
      store.conversations = {
        1: { assignedUser: 'John_Doe', lastUpdatedTimestamp: 2 },
        2: { assignedUser: 'Jason', lastUpdatedTimestamp: 3 },
        3: { assignedUser: 'Rachel', lastUpdatedTimestamp: 1 },
      };

      const result = store.getConversations();
      expect(result).toEqual([
        { id: '2', assignedUser: 'Jason', lastUpdatedTimestamp: 3 },
        { id: '3', assignedUser: 'Rachel', lastUpdatedTimestamp: 1 },
      ]);
    });

    it('should log error and return empty array when an error occurs', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      store.conversations = null;

      const result = store.getConversations();

      expect(console.error).toHaveBeenCalledWith('Error getting conversations:', expect.any(Error));
      expect(result).toEqual([]);
      vi.restoreAllMocks();
    });
  });

  describe('generateBlurb', () => {
    beforeEach(() => {
      store.conversations = {
        '1234abcd': {
          typingUsers: new Set(),
          blurb: '',
        },
      };
    });

    it('should set the blurb to the first 256 characters of the body when no users are typing', () => {
      const body =
        'The project contains a development server serving a front-end client application. The application automatically refreshes when you make changes to the source code. The development server supports both JavaScript and TypeScript.';
      store.generateBlurb('1234abcd', body);
      expect(store.conversations['1234abcd'].blurb).toBe(body.slice(0, 256));
    });

    it('should set the blurb to "[user] is replying..." when one user is typing', () => {
      store.conversations['1234abcd'].typingUsers.add('Jason');
      store.generateBlurb('1234abcd');
      expect(store.conversations['1234abcd'].blurb).toBe('Jason is replying...');
    });

    it('should set the blurb to "[user1], [user2] are replying..." when two or more users are typing', () => {
      store.conversations['1234abcd'].typingUsers.add('Jason');
      store.conversations['1234abcd'].typingUsers.add('Rachel');
      store.generateBlurb('1234abcd');
      expect(store.conversations['1234abcd'].blurb).toBe('Jason, Rachel are replying...');
    });
  });

  describe('getEventIdentifier', () => {
    it('should return a unique identifier for the event', () => {
      const event = {
        type: store.eventTypes.MESSAGE_RECEIVED,
        data: {
          user: 'Jason',
          timestamp: 1234567890,
          conversationId: '1234abcd',
          subject: 'Hello',
        },
      };

      const result = store.getEventIdentifier(event);
      expect(result).toBe('1234567890-1234abcd-messageReceived-Jason-Hello');
    });
  });

  describe('handleNewConversation', () => {
    it('should add a new conversation', () => {
      const event = {
        data: {
          conversationId: '1234abcd',
          user: 'Jason',
          subject: 'Hello',
        },
      };

      store.handleNewConversation(event);

      expect(store.conversations['1234abcd']).toEqual({
        assignedUser: 'Jason',
        subject: 'Hello',
        lastUpdatedTimestamp: 0,
        messageCount: 0,
        typingUsers: new Set(),
      });
    });
  });

  describe('handleMessageReceived', () => {
    it('should update the conversation with the new message', () => {
      store.conversations['1234abcd'] = {
        assignedUser: 'Jason',
        subject: 'Hello',
        lastUpdatedTimestamp: 0,
        messageCount: 0,
        typingUsers: new Set(),
        mostRecentMessage: '',
      };

      const event = {
        data: {
          timestamp: 1234567890,
          conversationId: '1234abcd',
          subject: 'Updated Subject',
          body: 'New message',
        },
      };

      store.handleMessageReceived(event);

      expect(store.conversations['1234abcd']).toEqual({
        assignedUser: 'Jason',
        subject: 'Updated Subject',
        lastUpdatedTimestamp: 0,
        messageCount: 1,
        typingUsers: new Set(),
        mostRecentMessage: 'New message',
        blurb: 'New message',
      });
    });

    it('should log error when an error occurs', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const event = { data: { conversationId: 'invalid_id', body: 'New message' } };

      store.handleMessageReceived(event);

      expect(console.error).toHaveBeenCalledWith('Error handling message received:', expect.any(Error));
      vi.restoreAllMocks();
    });
  });

  describe('handleAssigned', () => {
    it('should assign the user to the conversation', () => {
      const conversation = {};
      const data = { user: 'Rachel' };

      store.handleAssigned(conversation, data);

      expect(conversation.assignedUser).toBe('Rachel');
    });

    it('should log error when an error occurs', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const conversation = {};
      const data = { user: null };

      store.handleAssigned(conversation, data);

      expect(console.error).toHaveBeenCalledWith('Error handling assigned event:', expect.any(Error));
      vi.restoreAllMocks();
    });
  });

  describe('handleUnassigned', () => {
    it('should unassign the user from the conversation', () => {
      const conversation = { assignedUser: 'Rachel' };

      store.handleUnassigned(conversation);

      expect(conversation.assignedUser).toBeNull();
    });

    it('should log error when an error occurs', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      store.handleUnassigned(null);

      expect(console.error).toHaveBeenCalledWith('Error handling unassigned event:', expect.any(Error));
      vi.restoreAllMocks();
    });
  });

  describe('handleTypingStarted', () => {
    it('should add the user to the typing users set', () => {
      const conversation = { typingUsers: new Set() };
      const data = { user: 'Jason', conversationId: '1234abcd' };

      store.handleTypingStarted(conversation, data);

      expect(conversation.typingUsers.has('Jason')).toBe(true);
    });

    it('should log error when an error occurs', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      store.handleTypingStarted(null, { user: 'Jason', conversationId: '1234abcd' });

      expect(console.error).toHaveBeenCalledWith('Error handling typing started event:', expect.any(Error));
      vi.restoreAllMocks();
    });
  });

  describe('handleTypingStopped', () => {
    it('should remove the user from the typing users set', () => {
      const conversation = { typingUsers: new Set(['Jason']) };
      const data = { user: 'Jason', conversationId: '1234abcd' };

      store.handleTypingStopped(conversation, data);

      expect(conversation.typingUsers.has('Jason')).toBe(false);
    });

    it('should log error when an error occurs', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      store.handleTypingStopped(null, { user: 'Jason', conversationId: '1234abcd' });

      expect(console.error).toHaveBeenCalledWith('Error handling typing stopped event:', expect.any(Error));
      vi.restoreAllMocks();
    });
  });

  describe('handleEvent', () => {
    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should handle errors gracefully if conversationId is invalid', () => {
      const event = { type: store.eventTypes.MESSAGE_RECEIVED, data: { conversationId: null } };

      store.handleEvent(event);

      expect(console.error).toHaveBeenCalledWith('Error handling event:', expect.any(Error));
    });

    it('should process a new MESSAGE_RECEIVED event', () => {
      const event = {
        type: store.eventTypes.MESSAGE_RECEIVED,
        data: {
          timestamp: 1234567890,
          conversationId: '1234abcd',
          user: 'Jason',
          subject: 'Hello',
          body: 'Hello, World!',
        },
      };

      store.handleEvent(event);

      expect(store.conversations['1234abcd']).toEqual({
        assignedUser: 'Jason',
        subject: 'Hello',
        lastUpdatedTimestamp: 1234567890,
        messageCount: 1,
        typingUsers: new Set(),
        mostRecentMessage: 'Hello, World!',
        blurb: 'Hello, World!',
      });
    });
  });
});
