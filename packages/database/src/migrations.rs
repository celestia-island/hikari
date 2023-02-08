use sea_orm::DatabaseConnection;
use sea_orm_migration::prelude::*;
use sea_orm_migration::MigratorTrait;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Channel::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(Channel::Id).uuid().not_null().primary_key())
                    .col(ColumnDef::new(Channel::Label).string().not_null())
                    .to_owned(),
            )
            .await?;
        manager
            .create_table(
                Table::create()
                    .table(Post::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(Post::Id).uuid().not_null().primary_key())
                    .col(ColumnDef::new(Post::Parent).uuid().null())
                    .col(ColumnDef::new(Post::Author).uuid().not_null())
                    .col(ColumnDef::new(Post::Timestamp).timestamp().not_null())
                    .col(ColumnDef::new(Post::Content).string().not_null())
                    .to_owned(),
            )
            .await?;
        manager
            .create_table(
                Table::create()
                    .table(Tag::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(Tag::Id).uuid().not_null().primary_key())
                    .col(ColumnDef::new(Tag::Parent).uuid().null())
                    .col(ColumnDef::new(Tag::Label).string().not_null())
                    .to_owned(),
            )
            .await?;
        manager
            .create_table(
                Table::create()
                    .table(Thread::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(Thread::Id).uuid().not_null().primary_key())
                    .col(ColumnDef::new(Thread::Channel).uuid().not_null())
                    .col(ColumnDef::new(Thread::Tags).json().null())
                    .col(ColumnDef::new(Thread::Author).uuid().not_null())
                    .col(ColumnDef::new(Thread::Timestamp).timestamp().not_null())
                    .col(ColumnDef::new(Thread::Title).string().not_null())
                    .col(ColumnDef::new(Thread::Content).string().not_null())
                    .to_owned(),
            )
            .await?;
        manager
            .create_table(
                Table::create()
                    .table(User::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(User::Id).uuid().not_null().primary_key())
                    .col(ColumnDef::new(User::Name).string().not_null())
                    .col(ColumnDef::new(User::PasswordHash).string().not_null())
                    .col(ColumnDef::new(User::Email).string().null())
                    .col(ColumnDef::new(User::EmailVerified).boolean().not_null())
                    .col(ColumnDef::new(User::Bio).string().not_null())
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Channel::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(Post::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(Tag::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(Thread::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(User::Table).to_owned())
            .await?;

        Ok(())
    }
}

#[derive(Iden)]
enum Channel {
    #[iden = "channel"]
    Table,
    Id,
    Label,
}

#[derive(Iden)]
enum Post {
    #[iden = "post"]
    Table,
    Id,
    Parent,
    Author,
    Timestamp,
    Content,
}

#[derive(Iden)]
enum Tag {
    #[iden = "tag"]
    Table,
    Id,
    Parent,
    Label,
}

#[derive(Iden)]
enum Thread {
    #[iden = "thread"]
    Table,
    Id,
    Channel,
    Tags,
    Author,
    Timestamp,
    Title,
    Content,
}

#[derive(Iden)]
enum User {
    #[iden = "user"]
    Table,
    Id,
    Name,
    PasswordHash,
    Email,
    EmailVerified,
    Bio,
}

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![Box::new(Migration)]
    }
}

pub async fn init(db: &DatabaseConnection) -> Result<(), Box<dyn std::error::Error>> {
    Migrator::up(&db, None).await?;

    Ok(())
}
