"""
GitHub Integration Endpoints

Stores a GitHub PAT per user and proxies GitHub API calls.
"""

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.encryption import encrypt_value, decrypt_value
from app.models.user import User
from app.models.github_token import UserGitHubToken

router = APIRouter()

GITHUB_API = "https://api.github.com"


class GitHubTokenRequest(BaseModel):
    token: str


async def _get_token(user: User, db: AsyncSession) -> str:
    """Retrieve decrypted GitHub PAT for the user."""
    result = await db.execute(
        select(UserGitHubToken).where(UserGitHubToken.user_id == user.id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=400, detail="GitHub not connected")
    return decrypt_value(row.access_token)


async def _github_get(token: str, path: str, params: dict | None = None):
    """Make authenticated GET request to GitHub API."""
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{GITHUB_API}{path}",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github.v3+json",
            },
            params=params,
        )
        if resp.status_code == 401:
            raise HTTPException(status_code=401, detail="Invalid GitHub token")
        if resp.status_code == 403:
            raise HTTPException(status_code=403, detail="GitHub API rate limit or insufficient permissions")
        resp.raise_for_status()
        return resp.json()


# ─── Token Management ───

@router.put("/token")
async def save_github_token(
    request: GitHubTokenRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save (or update) a GitHub Personal Access Token."""
    # Validate token by fetching the authenticated user
    try:
        gh_user = await _github_get(request.token, "/user")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid GitHub token")

    username = gh_user.get("login", "")

    # Upsert
    result = await db.execute(
        select(UserGitHubToken).where(UserGitHubToken.user_id == user.id)
    )
    row = result.scalar_one_or_none()

    if row:
        row.access_token = encrypt_value(request.token)
        row.github_username = username
    else:
        row = UserGitHubToken(
            user_id=user.id,
            access_token=encrypt_value(request.token),
            github_username=username,
        )
        db.add(row)

    await db.commit()
    return {"status": "saved", "username": username}


@router.delete("/token")
async def delete_github_token(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove the GitHub token."""
    result = await db.execute(
        select(UserGitHubToken).where(UserGitHubToken.user_id == user.id)
    )
    row = result.scalar_one_or_none()
    if row:
        await db.delete(row)
        await db.commit()
    return {"status": "deleted"}


@router.get("/status")
async def github_status(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check if GitHub is connected."""
    result = await db.execute(
        select(UserGitHubToken).where(UserGitHubToken.user_id == user.id)
    )
    row = result.scalar_one_or_none()
    if not row:
        return {"connected": False}
    return {"connected": True, "username": row.github_username}


# ─── GitHub API Proxy ───

@router.get("/repos")
async def list_repos(
    page: int = 1,
    per_page: int = 30,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List the authenticated user's repositories."""
    token = await _get_token(user, db)
    repos = await _github_get(token, "/user/repos", {
        "sort": "updated",
        "direction": "desc",
        "per_page": per_page,
        "page": page,
        "type": "all",
    })

    return {
        "items": [
            {
                "full_name": r["full_name"],
                "name": r["name"],
                "owner": r["owner"]["login"],
                "private": r["private"],
                "description": r.get("description"),
                "language": r.get("language"),
                "updated_at": r["updated_at"],
            }
            for r in repos
        ]
    }


@router.get("/repos/{owner}/{repo}/pulls")
async def list_pulls(
    owner: str,
    repo: str,
    state: str = "all",
    page: int = 1,
    per_page: int = 30,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List pull requests for a repository."""
    token = await _get_token(user, db)

    gh_state = state if state in ("open", "closed", "all") else "all"

    pulls = await _github_get(token, f"/repos/{owner}/{repo}/pulls", {
        "state": gh_state,
        "sort": "updated",
        "direction": "desc",
        "per_page": per_page,
        "page": page,
    })

    return {
        "items": [
            {
                "number": pr["number"],
                "title": pr["title"],
                "state": "merged" if pr.get("merged_at") else pr["state"],
                "draft": pr.get("draft", False),
                "author": pr["user"]["login"],
                "author_avatar": pr["user"]["avatar_url"],
                "created_at": pr["created_at"],
                "updated_at": pr["updated_at"],
                "merged_at": pr.get("merged_at"),
                "labels": [
                    {"name": lb["name"], "color": lb.get("color", "888888")}
                    for lb in pr.get("labels", [])
                ],
                "reviewers": [
                    rv["login"] for rv in pr.get("requested_reviewers", [])
                ],
                "html_url": pr["html_url"],
                "body": (pr.get("body") or "")[:300],
            }
            for pr in pulls
        ]
    }


@router.get("/repos/{owner}/{repo}/pulls/{number}")
async def get_pull_detail(
    owner: str,
    repo: str,
    number: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get detailed info for a single pull request."""
    token = await _get_token(user, db)
    pr = await _github_get(token, f"/repos/{owner}/{repo}/pulls/{number}")

    # Fetch changed files list
    try:
        files_raw = await _github_get(token, f"/repos/{owner}/{repo}/pulls/{number}/files")
        files = [
            {
                "filename": f["filename"],
                "status": f.get("status", "modified"),
                "additions": f.get("additions", 0),
                "deletions": f.get("deletions", 0),
                "changes": f.get("changes", 0),
            }
            for f in (files_raw if isinstance(files_raw, list) else [])[:50]
        ]
    except Exception:
        files = []

    return {
        "number": pr["number"],
        "title": pr["title"],
        "body": pr.get("body") or "",
        "state": "merged" if pr.get("merged_at") else pr["state"],
        "draft": pr.get("draft", False),
        "author": pr["user"]["login"],
        "author_avatar": pr["user"]["avatar_url"],
        "created_at": pr["created_at"],
        "updated_at": pr["updated_at"],
        "merged_at": pr.get("merged_at"),
        "changed_files": pr.get("changed_files", 0),
        "additions": pr.get("additions", 0),
        "deletions": pr.get("deletions", 0),
        "labels": [
            {"name": lb["name"], "color": lb.get("color", "888888")}
            for lb in pr.get("labels", [])
        ],
        "reviewers": [
            rv["login"] for rv in pr.get("requested_reviewers", [])
        ],
        "html_url": pr["html_url"],
        "files": files,
    }
