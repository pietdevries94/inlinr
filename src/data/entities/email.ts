export interface Email {
  id: string;
  subject: string;
  body: string;
  sender: string;
  recipient: string;
  cc: string;
  sentAt: Date;
  historyId: string;
  labelIds: string[];
  threadId: string;
}
