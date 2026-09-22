import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole, paginationQuerySchema, searchSchema, uuidSchema } from '@south/shared';
import { z } from 'zod';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ZodQuery } from '../../common/validation/zod.decorators';
import { paginate, toSkipTake } from '../../common/utils/pagination.util';
import { Roles } from '../auth/decorators';

const usersQuerySchema = paginationQuerySchema
  .extend({
    role: z.nativeEnum(UserRole).optional(),
    baseId: uuidSchema.optional(),
    teamId: uuidSchema.optional(),
    search: searchSchema,
  })
  .strict();

@ApiTags('Users')
@Controller('users')
// NoCyberHere: AUTHORIZATION
// Threat: חשיפת רשימת משתמשים ומספרים אישיים למשתמש שאינו מורשה
// Reason: רק מפקד לוגיסטיקה רשאי לראות רשימת משתמשים, והתשובה אינה כוללת מספר אישי או האש סיסמה.
@Roles(UserRole.LOGISTICS_COMMANDER)
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({
    summary: 'רשימת משתמשים',
    description: 'משמשת לשיוך חייל מבצע למשימה או לשליחות. מיועדת למפקד לוגיסטיקה בלבד.',
  })
  async list(
    @ZodQuery(usersQuerySchema, 'UsersQuery') query: z.infer<typeof usersQuerySchema>,
  ) {
    const where = {
      role: query.role,
      baseId: query.baseId,
      teamId: query.teamId,
      isActive: true,
      fullName: query.search ? { contains: query.search, mode: 'insensitive' as const } : undefined,
    };

    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          baseId: true,
          teamId: true,
          base: { select: { name: true } },
          team: { select: { name: true } },
        },
        orderBy: { fullName: 'asc' },
        ...toSkipTake(query),
      }),
    ]);

    return paginate(
      users.map((user) => ({
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        baseId: user.baseId,
        baseName: user.base?.name ?? null,
        teamId: user.teamId,
        teamName: user.team?.name ?? null,
      })),
      total,
      query,
    );
  }
}
