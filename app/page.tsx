"use client";

import Providers from "./providers";
import GameCanvas from "@/components/GameCanvas";
import { useBaseAccount } from "@base-org/account/react";

export default function Home() {
  const { connect, account } = useBaseAccount();

  return (
    <Providers>
      <main style={{ textAlign: "center", padding: 20 }}>
        <h1>🎯 Base Archery Game</h1>

        {!account && (
          <button onClick={connect}>
            Connect Base Wallet
          </button>
        )}

        {account && (
          <>
            <p>Connected: {account}</p>
            <GameCanvas />
          </>
        )}
      </main>
    </Providers>
  );
}
