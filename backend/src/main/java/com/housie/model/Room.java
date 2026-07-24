package com.housie.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "rooms")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Room {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long roomId;

    @Column(unique = true, nullable = false, length = 6)
    private String roomCode;

    @Column(nullable = false)
    private String gameName;

    @Column(nullable = false)
    private String hostId;

    @Column(nullable = false)
    private String hostName;

    private Integer maxPlayers;

    @Builder.Default
    private Integer callingIntervalSeconds = 3;

    @Column(nullable = false)
    private String status; // WAITING, PLAYING, FINISHED

    @Column(nullable = false)
    private LocalDateTime createdAt;
}
