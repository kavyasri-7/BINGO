package com.housie.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "players")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Player {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long playerId;

    @Column(nullable = false)
    private String roomCode;

    @Column(nullable = false)
    private String userUid;

    @Column(nullable = false)
    private String nickname;

    @Column(nullable = false)
    private Boolean isHost;

    @Column(nullable = false)
    private LocalDateTime joinedTime;
}
