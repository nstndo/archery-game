"use client";

import { BaseAccountProvider } from "@base-org/account/react";

export default function Providers({ children }: any) {
  return <BaseAccountProvider>{children}</BaseAccountProvider>;
}
