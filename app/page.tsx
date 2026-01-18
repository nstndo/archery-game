"use client";

import { useState } from "react";
import GameCanvas from "@/components/GameCanvas";

export default function Home() {
  const [account, setAccount] = useState<string | null>(null);

  async function connectWallet() {
    if (!window.ethereum) {
      alert("Wallet not found");
      return;
    }

    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });

    setAccount(accounts[0]);
  }

  return (
    <main style={{ textAlign: "center", padding: 20 }}>
      <h1>🎯 Base Archery</h1>

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