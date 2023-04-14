/* eslint-disable prefer-const */
import { Pair, Token, Bundle } from "../generated/schema";
import {
  BigDecimal,
  Address,
  BigInt,
  log,
} from "@graphprotocol/graph-ts/index";
import {
  ZERO_BD,
  factoryContract,
  ADDRESS_ZERO,
  ONE_BD,
  UNTRACKED_PAIRS,
} from "./helpers";

const WETH_ADDRESS = "0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91".toLowerCase();
const USDC_WETH_PAIR = "0xc402a6f07d003456b7e3e00f80b558aa5be0cc81"; // created 10008355

export function getEthPriceInUSD(): BigDecimal {
  // fetch eth prices for each stablecoin
  let usdcPair = Pair.load(USDC_WETH_PAIR); // usdc is token0
  // all 3 have been created
  if (usdcPair !== null) {
    log.debug(
      `
    usdcPair ${usdcPair.id}
    usdcPair.token0Price: ${usdcPair.token0Price}
    usdcPair.token1Price: ${usdcPair.token1Price}
    `,
      []
    );
    return usdcPair.token0Price;
  } else {
    return ZERO_BD;
  }
}

// token where amounts should contribute to tracked volume and liquidity
let WHITELIST: string[] = [
  "0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91".toLowerCase(), // WETH
  "0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4".toLowerCase(), // USDC
];

// minimum liquidity required to count towards tracked volume for pairs with small # of Lps
let MINIMUM_USD_THRESHOLD_NEW_PAIRS = BigDecimal.fromString("400");

// minimum liquidity for price to get tracked
let MINIMUM_LIQUIDITY_THRESHOLD_ETH = BigDecimal.fromString("0.2");

/**
 * Search through graph to find derived Eth per token.
 * @todo update to be derived ETH (add stablecoin estimates)
 **/
export function findEthPerToken(token: Token): BigDecimal {
  if (token.id == WETH_ADDRESS) {
    return ONE_BD;
  }
  // loop through whitelist and check if paired with any
  for (let i = 0; i < WHITELIST.length; ++i) {
    let pairAddress = factoryContract.getPair(
      Address.fromString(token.id),
      Address.fromString(WHITELIST[i])
    );
    if (pairAddress.toHexString() != ADDRESS_ZERO) {
      let pair = Pair.load(pairAddress.toHexString()) as Pair;

      if (
        pair.token0 == token.id &&
        pair.reserveETH.gt(MINIMUM_LIQUIDITY_THRESHOLD_ETH)
      ) {
        let token1 = Token.load(pair.token1) as Token;

        return pair.token1Price.times(token1.derivedETH as BigDecimal); // return token1 per our token * Eth per token 1
      }
      if (
        pair.token1 == token.id &&
        pair.reserveETH.gt(MINIMUM_LIQUIDITY_THRESHOLD_ETH)
      ) {
        let token0 = Token.load(pair.token0) as Token;

        return pair.token0Price.times(token0.derivedETH as BigDecimal); // return token0 per our token * ETH per token 0
      }
    }
  }
  return ZERO_BD; // nothing was found return 0
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD.
 * If both are, return average of two amounts
 * If neither is, return 0
 */
export function getTrackedVolumeUSD(
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token,
  pair: Pair
): BigDecimal {
  let bundle = Bundle.load("1") as Bundle;
  let price0 = (token0.derivedETH as BigDecimal).times(bundle.ethPrice);
  let price1 = (token1.derivedETH as BigDecimal).times(bundle.ethPrice);

  // dont count tracked volume on these pairs - usually rebass tokens
  if (UNTRACKED_PAIRS.includes(pair.id.toLowerCase())) {
    return ZERO_BD;
  }

  // if less than 5 LPs, require high minimum reserve amount amount or return 0
  if (pair.liquidityProviderCount.lt(BigInt.fromI32(5))) {
    let reserve0USD = pair.reserve0.times(price0);
    let reserve1USD = pair.reserve1.times(price1);

    if (
      WHITELIST.includes(token0.id.toLowerCase()) &&
      WHITELIST.includes(token1.id.toLowerCase())
    ) {
      if (reserve0USD.plus(reserve1USD).lt(MINIMUM_USD_THRESHOLD_NEW_PAIRS)) {
        return ZERO_BD;
      }
    }
    if (
      WHITELIST.includes(token0.id.toLowerCase()) &&
      !WHITELIST.includes(token1.id.toLowerCase())
    ) {
      if (
        reserve0USD
          .times(BigDecimal.fromString("2"))
          .lt(MINIMUM_USD_THRESHOLD_NEW_PAIRS)
      ) {
        return ZERO_BD;
      }
    }
    if (
      !WHITELIST.includes(token0.id.toLowerCase()) &&
      WHITELIST.includes(token1.id.toLowerCase())
    ) {
      if (
        reserve1USD
          .times(BigDecimal.fromString("2"))
          .lt(MINIMUM_USD_THRESHOLD_NEW_PAIRS)
      ) {
        return ZERO_BD;
      }
    }
  }

  // both are whitelist tokens, take average of both amounts
  if (
    WHITELIST.includes(token0.id.toLowerCase()) &&
    WHITELIST.includes(token1.id.toLowerCase())
  ) {
    return tokenAmount0
      .times(price0)
      .plus(tokenAmount1.times(price1))
      .div(BigDecimal.fromString("2"));
  }

  // take full value of the whitelisted token amount
  if (
    WHITELIST.includes(token0.id.toLowerCase()) &&
    !WHITELIST.includes(token1.id.toLowerCase())
  ) {
    return tokenAmount0.times(price0);
  }

  // take full value of the whitelisted token amount
  if (
    !WHITELIST.includes(token0.id.toLowerCase()) &&
    WHITELIST.includes(token1.id.toLowerCase())
  ) {
    return tokenAmount1.times(price1);
  }

  // neither token is on white list, tracked volume is 0
  return ZERO_BD;
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD * 2.
 * If both are, return sum of two amounts
 * If neither is, return 0
 */
export function getTrackedLiquidityUSD(
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token
): BigDecimal {
  let bundle = Bundle.load("1") as Bundle;
  let price0 = (token0.derivedETH as BigDecimal).times(bundle.ethPrice);
  let price1 = (token1.derivedETH as BigDecimal).times(bundle.ethPrice);

  // both are whitelist tokens, take average of both amounts
  if (
    WHITELIST.includes(token0.id.toLowerCase()) &&
    WHITELIST.includes(token1.id.toLowerCase())
  ) {
    return tokenAmount0.times(price0).plus(tokenAmount1.times(price1));
  }

  // take double value of the whitelisted token amount
  if (
    WHITELIST.includes(token0.id.toLowerCase()) &&
    !WHITELIST.includes(token1.id.toLowerCase())
  ) {
    return tokenAmount0.times(price0).times(BigDecimal.fromString("2"));
  }

  // take double value of the whitelisted token amount
  if (
    !WHITELIST.includes(token0.id.toLowerCase()) &&
    WHITELIST.includes(token1.id.toLowerCase())
  ) {
    return tokenAmount1.times(price1).times(BigDecimal.fromString("2"));
  }

  // neither token is on white list, tracked volume is 0
  return ZERO_BD;
}
