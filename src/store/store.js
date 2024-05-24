export class Store {
  /**
   * Returns an array of conversation objects in reverse chronological order.
   *
   * @returns {readonly {
   *   id: string,
   *   assignedUser: string | null,
   *   subject: string,
   *   blurb: string,
   *   messageCount: number,
   *   lastUpdatedTimestamp: number
   * }[]}
   */
  getConversations() {
    // TODO
    return [
      {
        id: '1234abcd',
        assignedUser: 'Laurent.Perrin',
        subject: 'Re: Lorem ipsum',
        blurb: 'TODO',
        messageCount: 2,
        lastUpdatedTimestamp: 1650949681692,
      },
    ];
  }

  /**
   * Handles an event that updates the state of a conversation.
   *
   * @param {{
   *   type: string,
   *   data: {
   *     timestamp: number,
   *     conversationId: string,
   *     user?: string,
   *     subject?: string,
   *     body?: string
   *   }
   * }} event
   * @returns {void}
   */
  handleEvent(event) {
    // TODO
    console.log('Received event', event);
  }
}
