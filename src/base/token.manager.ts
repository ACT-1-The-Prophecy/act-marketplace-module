export class TokenManager {
    private token: string | null = null;
    private tokenExpiry: number | null = null;

    constructor(
        private authReqeust: () => Promise<string>,
        private tokenLifetimeMins: number = 55
    ) {}

    async getValidToken(): Promise<string> {
        if (!this.isTokenValid()) {
            await this.refreshToken();
        }
        return this.token!;
    }

    private isTokenValid(): boolean {
        return (
            this.token !== null &&
            this.tokenExpiry !== null &&
            Date.now() < this.tokenExpiry
        );
    }

    private async refreshToken(): Promise<void> {
        this.token = await this.authReqeust();
        this.tokenExpiry = Date.now() + this.tokenLifetimeMins * 60 * 1000;
    }

    invalidateToken(): void {
        this.token = null;
        this.tokenExpiry = null;
    }
}
