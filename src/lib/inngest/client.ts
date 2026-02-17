import { EventSchemas, Inngest } from "inngest";

import { appConfig } from "@/lib/config";
import { env } from "@/lib/env";

type Events = {
  "auth/verification.requested": {
    data: {
      email: string;
      name: string;
      token: string;
    };
  };
  "auth/password-reset.requested": {
    data: {
      email: string;
      name: string;
      token: string;
    };
  };
  "auth/email-change.requested": {
    data: {
      email: string;
      name: string;
      token: string;
    };
  };
};

export const inngest = new Inngest({
  id: appConfig.slug,
  eventKey: env.INNGEST_EVENT_KEY,
  schemas: new EventSchemas().fromRecord<Events>(),
});
