const sendAuthorizationBrand: unique symbol = Symbol("SendAuthorization");

export interface SendAuthorization {
  readonly [sendAuthorizationBrand]: true;
  readonly actionId: string;
}

/** @internal */
export interface AuthorizationDetails {
  readonly authorizationId: string;
  readonly actionId: string;
  readonly expectedVersion: number;
  readonly attemptNumber: number;
  readonly runtimeId: string;
  readonly role: "game";
  readonly clientId: string;
  readonly expiresAt: number;
  readonly runtimeOwnerId: string;
  readonly repositoryOwner: object;
}

const issued = new WeakMap<SendAuthorization, AuthorizationDetails>();

/** @internal */
export function issueSendAuthorization(details: AuthorizationDetails): SendAuthorization {
  const authorization: SendAuthorization = {
    [sendAuthorizationBrand]: true,
    actionId: details.actionId,
  };
  Object.freeze(authorization);
  issued.set(authorization, details);
  return authorization;
}

/** @internal */
export function readSendAuthorization(
  authorization: SendAuthorization,
  repositoryOwner: object,
): AuthorizationDetails | null {
  if (
    typeof authorization !== "object" ||
    authorization === null ||
    !Object.isFrozen(authorization)
  ) {
    return null;
  }
  const details = issued.get(authorization);
  return details?.repositoryOwner === repositoryOwner ? details : null;
}
