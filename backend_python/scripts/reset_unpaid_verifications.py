"""Reset is_verified for users who have not purchased VERIFIED_BADGE or had a verification request approved."""

import asyncio
from sqlalchemy import select, update
from app.core.database import SessionLocal
from app.models.user import User
from app.models.payment import WalletTransaction
from app.models.verification import VerificationRequest, VerificationStatus


async def reset_unpaid():
    async with SessionLocal() as session:
        # 1. Find users who legitimately purchased VERIFIED_BADGE
        purchased_users = (
            await session.execute(
                select(WalletTransaction.user_id)
                .where(WalletTransaction.service_type == "VERIFIED_BADGE")
            )
        ).scalars().all()
        legit_user_ids = set(purchased_users)

        # 2. Find users who had a document verification approved by admin
        approved_users = (
            await session.execute(
                select(VerificationRequest.user_id)
                .where(VerificationRequest.status == VerificationStatus.APPROVED.value)
            )
        ).scalars().all()
        legit_user_ids.update(approved_users)

        print(f"Users with legit verification: {len(legit_user_ids)}")

        # 3. Reset is_verified = False for all others who currently have is_verified = True
        stmt = (
            update(User)
            .where(User.is_verified == True)
        )
        if legit_user_ids:
            stmt = stmt.where(~User.id.in_(legit_user_ids))

        stmt = stmt.values(is_verified=False)
        result = await session.execute(stmt)
        await session.commit()
        print(f"Reset {result.rowcount} unverified users to is_verified = False.")


if __name__ == "__main__":
    asyncio.run(reset_unpaid())
