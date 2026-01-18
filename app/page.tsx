"use client";

import GameCanvas from "@/components/GameCanvas";
import { useEffect, useState } from "react";

export default function Home() {
  const [account, setAccount] = useState<string | null>(null);

  async function connectWallet() {
    if (!window.ethereum) {
      alert("Install wallet");
      return;
    }

    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });

    setAccount(accounts[0]);
  }

  return (
    <main style={{ textAlign: "center", padding: 20 }}>
      <h1>🎯 Base Archery Game</h1>

      {!account && (
        <button onClick={connectWallet}>
          Connect Wallet
        </button>
      )}

      {account && (
        <>
          <p>Connected: {account}</p>
          <GameCanvas />
        </>
      )}
    </main>
  );
}
