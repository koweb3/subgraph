import { Address, BigInt } from "@graphprotocol/graph-ts";

// Initialize a Token Definition with the attributes
export class TokenDefinition {
  address: Address;
  symbol: string;
  name: string;
  decimals: BigInt;

  // Initialize a Token Definition with its attributes
  constructor(
    address: Address,
    symbol: string,
    name: string,
    decimals: BigInt
  ) {
    this.address = address;
    this.symbol = symbol;
    this.name = name;
    this.decimals = decimals;
  }

  // Get all tokens with a static defintion
  static getStaticDefinitions(): Array<TokenDefinition> {
    let staticDefinitions = new Array<TokenDefinition>(3);

    // Add USDC
    let tokenUSDC = new TokenDefinition(
      Address.fromString("0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4"),
      "USDC",
      "USD Coin",
      BigInt.fromI32(6)
    );
    staticDefinitions.push(tokenUSDC);

    // Add USDT
    let tokenUSDT = new TokenDefinition(
      Address.fromString("0x59ac51cfb025adce007d1ec96a21f7c7e3f32330"),
      "USDT",
      "Tether USD",
      BigInt.fromI32(18)
    );
    staticDefinitions.push(tokenUSDT);

    // Add WETH
    let tokenWETH = new TokenDefinition(
      Address.fromString("0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91"),
      "WETH",
      "Wrapped Ether",
      BigInt.fromI32(18)
    );
    staticDefinitions.push(tokenWETH);

    return staticDefinitions;
  }

  // Helper for hardcoded tokens
  static fromAddress(tokenAddress: Address): TokenDefinition | null {
    let staticDefinitions = this.getStaticDefinitions();
    let tokenAddressHex = tokenAddress.toHexString();

    // Search the definition using the address
    for (let i = 0; i < staticDefinitions.length; i++) {
      let staticDefinition = staticDefinitions[i];
      if (staticDefinition.address.toHexString() == tokenAddressHex) {
        return staticDefinition;
      }
    }

    // If not found, return null
    return null;
  }
}
