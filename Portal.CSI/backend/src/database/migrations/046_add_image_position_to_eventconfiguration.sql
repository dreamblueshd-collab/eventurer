IF COL_LENGTH('EventConfiguration', 'HeroImagePositionX') IS NULL
BEGIN
  ALTER TABLE EventConfiguration ADD HeroImagePositionX INT NOT NULL CONSTRAINT DF_EventConfiguration_HeroImagePositionX DEFAULT 50;
END
GO

IF COL_LENGTH('EventConfiguration', 'HeroImagePositionY') IS NULL
BEGIN
  ALTER TABLE EventConfiguration ADD HeroImagePositionY INT NOT NULL CONSTRAINT DF_EventConfiguration_HeroImagePositionY DEFAULT 50;
END
GO

IF COL_LENGTH('EventConfiguration', 'LogoPositionX') IS NULL
BEGIN
  ALTER TABLE EventConfiguration ADD LogoPositionX INT NOT NULL CONSTRAINT DF_EventConfiguration_LogoPositionX DEFAULT 50;
END
GO

IF COL_LENGTH('EventConfiguration', 'LogoPositionY') IS NULL
BEGIN
  ALTER TABLE EventConfiguration ADD LogoPositionY INT NOT NULL CONSTRAINT DF_EventConfiguration_LogoPositionY DEFAULT 50;
END
GO

IF COL_LENGTH('EventConfiguration', 'BackgroundPositionX') IS NULL
BEGIN
  ALTER TABLE EventConfiguration ADD BackgroundPositionX INT NOT NULL CONSTRAINT DF_EventConfiguration_BackgroundPositionX DEFAULT 50;
END
GO

IF COL_LENGTH('EventConfiguration', 'BackgroundPositionY') IS NULL
BEGIN
  ALTER TABLE EventConfiguration ADD BackgroundPositionY INT NOT NULL CONSTRAINT DF_EventConfiguration_BackgroundPositionY DEFAULT 50;
END
GO
